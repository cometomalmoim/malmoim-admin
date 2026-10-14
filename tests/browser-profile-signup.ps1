# Requires app port 3101, isolated fixture port 3102, and a separate headless Edge debugging port 9226.
# Run from the repository root. This script does not create accounts or submit credentials.
$ErrorActionPreference = 'Stop'
$taskRoot = (Get-Location).ProviderPath
$tabs = Invoke-RestMethod 'http://127.0.0.1:9226/json'
$tab = $tabs | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$socket.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:messageId = 0
$script:postCount = 0
function Invoke-Cdp($method, $parameters = @{}) {
  $script:messageId++
  $id = $script:messageId
  $message = @{ id = $id; method = $method; params = $parameters } | ConvertTo-Json -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($message)
  $timeout = [Threading.CancellationTokenSource]::new(20000)
  try {
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $timeout.Token).GetAwaiter().GetResult()
    while ($true) {
      $stream = [IO.MemoryStream]::new()
      do {
        $buffer = [byte[]]::new(65536)
        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $timeout.Token).GetAwaiter().GetResult()
        $stream.Write($buffer, 0, $received.Count)
      } while (-not $received.EndOfMessage)
      $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      $stream.Dispose()
      if ($response.method -eq 'Network.requestWillBeSent' -and $response.params.request.method -eq 'POST') { $script:postCount++ }
      if ($response.id -eq $id) {
        if ($response.error) { throw ('CDP error: ' + $method) }
        return $response.result
      }
    }
  } finally { $timeout.Dispose() }
}
function Evaluate($expression) {
  $value = Invoke-Cdp 'Runtime.evaluate' @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  if ($value.exceptionDetails) { throw 'Browser evaluation failed' }
  return $value.result.value
}
function Wait-Page($path, $selector) {
  for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 250
    try {
      if (Evaluate ("location.pathname === '" + $path + "' && !!document.querySelector('" + $selector + "')")) { return }
    } catch { }
  }
  throw ('Page did not settle: ' + $path)
}
function Assert-Browser($label, $expression) {
  $passed = $false
  for ($attempt=0; $attempt -lt 20; $attempt++) { if (Evaluate $expression) { $passed=$true; break }; Start-Sleep -Milliseconds 50 }
  if (-not $passed) { throw ('FAIL: ' + $label) }
  Write-Output ('PASS: ' + $label)
}
function Viewport($width, $height, $mobile) {
  $null = Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{ width=$width; height=$height; deviceScaleFactor=1; mobile=$mobile }
}

$null = Invoke-Cdp 'Page.enable'
$null = Invoke-Cdp 'Runtime.enable'
$null = Invoke-Cdp 'Network.enable'
Viewport 1440 1000 $false
$null = Invoke-Cdp 'Page.navigate' @{ url='http://localhost:3102/' }
Wait-Page '/' '.public-profile-trigger'
$null = Evaluate "document.querySelector('.public-profile-trigger').focus()"
$null = Invoke-Cdp 'Input.dispatchKeyEvent' @{ type='keyDown'; key='Enter'; code='Enter'; text=([string][char]13); unmodifiedText=([string][char]13); windowsVirtualKeyCode=13 }
$null = Invoke-Cdp 'Input.dispatchKeyEvent' @{ type='keyUp'; key='Enter'; code='Enter'; windowsVirtualKeyCode=13 }
Assert-Browser 'Profile opens with Enter' "document.querySelector('.public-profile-trigger').getAttribute('aria-expanded') === 'true'"
Assert-Browser 'Entire long email appears only in dropdown' "document.querySelector('.public-profile-email').innerText === 'long-test-address-'.repeat(8) + '@example.test'"
Assert-Browser 'Long email wraps inside panel' "document.querySelector('.public-profile-panel').scrollWidth <= document.querySelector('.public-profile-panel').clientWidth"
$null = Invoke-Cdp 'Input.dispatchKeyEvent' @{ type='keyDown'; key='Escape'; code='Escape'; windowsVirtualKeyCode=27 }
$null = Invoke-Cdp 'Input.dispatchKeyEvent' @{ type='keyUp'; key='Escape'; code='Escape'; windowsVirtualKeyCode=27 }
Assert-Browser 'Escape closes and restores focus' "document.querySelector('.public-profile-trigger').getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector('.public-profile-trigger')"
$null = Evaluate "document.querySelector('.public-profile-trigger').click()"
$null = Evaluate "document.querySelector('#outside').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"
Assert-Browser 'Outside pointer closes profile' "document.querySelector('.public-profile-trigger').getAttribute('aria-expanded') === 'false'"
$null = Evaluate "document.querySelector('.public-profile-trigger').click()"
Assert-Browser 'Profile reopened for keyboard navigation' "!!document.querySelector('.public-profile-panel')"
$null = Evaluate "document.querySelector('.public-profile-panel form button').focus()"
Assert-Browser 'Logout control is keyboard reachable' "document.activeElement === document.querySelector('.public-profile-panel form button')"
$null = Evaluate "document.querySelector('#outside').focus()"
Assert-Browser 'Focus leaving profile closes it' "document.querySelector('.public-profile-trigger').getAttribute('aria-expanded') === 'false'"
Viewport 390 844 $true
$null = Evaluate "document.querySelector('.public-profile-trigger').click()"
Assert-Browser 'Mobile profile panel stays in viewport' "document.querySelector('.public-profile-panel').getBoundingClientRect().left >= 0 && document.querySelector('.public-profile-panel').getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth"
Assert-Browser 'Mypage is unavailable and logout is present' "document.querySelector('.public-profile-mypage').disabled && !!document.querySelector('.public-profile-panel form button')"
Start-Sleep -Milliseconds 250
$shot = Invoke-Cdp 'Page.captureScreenshot' @{ format='png' }
[IO.File]::WriteAllBytes((Join-Path $taskRoot '.next/profile-menu-mobile.png'), [Convert]::FromBase64String($shot.data))

$null = Invoke-Cdp 'Page.navigate' @{ url='http://localhost:3101/' }
Wait-Page '/' '.public-account a'
Start-Sleep -Milliseconds 400
Assert-Browser 'Anonymous header has only login' "document.querySelector('.public-account a')?.getAttribute('href') === '/auth/login' && document.querySelectorAll('.public-account a').length === 1 && !document.querySelector('.public-signup-link')"
foreach ($width in @(320,390,1024,1440)) {
  Viewport $width 900 ($width -lt 640)
  Assert-Browser ("Header has no horizontal overflow at " + $width) "document.documentElement.scrollWidth <= innerWidth"
  Assert-Browser ("Account entry visible at " + $width) "document.querySelector('.public-account a').getBoundingClientRect().width > 0"
}
Viewport 390 844 $true
$null = Evaluate "document.querySelector('.public-account a').click()"
Wait-Page '/auth/login' '.login-card'
Assert-Browser 'Login page retains signup link' "Array.from(document.querySelectorAll('.login-card a')).some(link=>link.getAttribute('href')==='/signup')"
$null = Evaluate "Array.from(document.querySelectorAll('.login-card a')).find(link=>link.getAttribute('href')==='/signup').click()"
Wait-Page '/signup' '.signup-form'
for ($i=0;$i -lt 30;$i++) { if (Evaluate "!document.querySelector('.signup-form fieldset').disabled") { break }; Start-Sleep -Milliseconds 100 }
Assert-Browser 'Three signup sections and noindex' "document.querySelectorAll('.signup-section').length === 3 && document.querySelector('meta[name=robots]').content.includes('noindex')"
Assert-Browser 'Korean retains all five levels' "Array.from(document.querySelector('#koreanLevel').options).filter(option=>option.value).length===5 && Array.from(document.querySelector('#koreanLevel').options).some(option=>option.value==='none')"
Assert-Browser 'Foreign proficiency has exactly the four requested levels' "JSON.stringify(Array.from(document.querySelector('[name=foreignLevel]').options).filter(option=>option.value).map(option=>option.value))===JSON.stringify(['basic','conversational','fluent','native'])"
Assert-Browser 'Pending consent cannot be accepted'  "document.querySelector('input[name=privacyConsent]').disabled"
Assert-Browser 'Signup has no username field' "!document.querySelector('input[name=username]')"
Assert-Browser 'Mobile form has no horizontal overflow' "document.documentElement.scrollWidth <= innerWidth"
Start-Sleep -Milliseconds 250
$shot = Invoke-Cdp 'Page.captureScreenshot' @{ format='png' }
[IO.File]::WriteAllBytes((Join-Path $taskRoot '.next/signup-mobile.png'), [Convert]::FromBase64String($shot.data))
$null = Evaluate "document.querySelector('.signup-submit button').click()"
Start-Sleep -Milliseconds 200
Assert-Browser 'Required errors appear next to inputs' "document.querySelectorAll('.signup-error').length >= 8 && document.activeElement.id === 'email'"
$null = Evaluate @"
(()=>{const set=(name,value)=>{const element=document.querySelector('[name='+name+']');element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));};set('email','member@example.test');set('password','test-only-password');set('passwordConfirmation','mismatch');set('name','Test Member');set('nationality','KR');set('phoneNumber','10-1234-5678');set('gender','undisclosed');set('birthDate','2000-02-29');set('koreanLevel','native');set('foreignLanguage','en');set('foreignLevel','conversational');})()
"@
$null = Evaluate "document.querySelector('.signup-submit button').click()"
Start-Sleep -Milliseconds 200
Assert-Browser 'Password mismatch is displayed' "!!document.querySelector('#passwordConfirmation-error')"
$null = Evaluate "document.querySelector('#passwordConfirmation').value='test-only-password'"
$null = Evaluate "document.querySelector('.signup-submit button').click()"
Start-Sleep -Milliseconds 200
Assert-Browser 'Valid input reports preview only, not successful signup' "document.querySelector('.signup-submit [role=status]')?.innerText.includes('회원가입은 아직 완료되지 않았습니다')"
$null = Evaluate "document.querySelector('.password-field button').click()"
Assert-Browser 'Both signup passwords toggle visibility' "document.querySelector('#password').type === 'text' && document.querySelector('#passwordConfirmation').type === 'text'"
$null = Evaluate "document.querySelector('.password-field button').click()"
$null = Evaluate "(async()=>{for(let i=0;i<8;i++){document.querySelector('.signup-add').click();await new Promise(requestAnimationFrame);}})()"
Assert-Browser 'Language additions stop at five' "document.querySelectorAll('.signup-language-row').length === 5 && document.querySelector('.signup-add').disabled"
Assert-Browser 'Adding rows preserves existing language values' "document.querySelector('[name=foreignLanguage]').value === 'en' && document.querySelector('[name=foreignLevel]').value === 'conversational'"
Assert-Browser 'Already selected language disabled in other rows' "Array.from(document.querySelectorAll('[name=foreignLanguage]')[1].options).find(option=>option.value==='en').disabled"
$null = Evaluate @"
(()=>{const languages=document.querySelectorAll('[name=foreignLanguage]');const levels=document.querySelectorAll('[name=foreignLevel]');languages[1].value='ja';languages[1].dispatchEvent(new Event('change',{bubbles:true}));levels[1].value='basic';levels[1].dispatchEvent(new Event('change',{bubbles:true}));languages[2].value='zh';languages[2].dispatchEvent(new Event('change',{bubbles:true}));levels[2].value='fluent';levels[2].dispatchEvent(new Event('change',{bubbles:true}));})()
"@
$null = Evaluate "document.querySelectorAll('.signup-remove')[1].click()"
Assert-Browser 'Deleting middle row preserves other language and proficiency values' "document.querySelectorAll('[name=foreignLanguage]')[1].value==='zh' && document.querySelectorAll('[name=foreignLevel]')[1].value==='fluent'"
$null = Evaluate "document.querySelector('#callingCode').value='other';document.querySelector('#callingCode').dispatchEvent(new Event('change',{bubbles:true}))"
Assert-Browser 'Custom international calling code supported' "!!document.querySelector('#customCallingCode')"
if ($script:postCount -ne 0) { throw 'Unexpected POST while previewing signup' }
Write-Output 'PASS: No POST requests or credential submissions during signup preview'
$null = Invoke-Cdp 'Page.navigate' @{ url='http://localhost:3101/admin' }
Wait-Page '/login' '.login-card h1'
Assert-Browser 'Existing admin login and unauthenticated access control preserved' "location.pathname==='/login' && document.querySelector('.login-card h1').innerText==='말모임 Admin'"
$socket.Dispose()
Write-Output 'Completed isolated UI and signup browser checks.'
