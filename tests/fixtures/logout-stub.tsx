// Only bundled by tests/profile-fixture.mjs; never included in the application.
export function LogoutForm() {
  return <form onSubmit={event => event.preventDefault()}><button type="submit">로그아웃</button></form>;
}
