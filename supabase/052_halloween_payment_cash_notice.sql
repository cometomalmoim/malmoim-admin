-- Append revisions only. No queued messages or previous bodies are changed.
begin;
do $$
declare t public.event_sms_templates; old_text text; new_text text;
begin
 perform pg_advisory_xact_lock(hashtextextended((select id::text from public.recruitment_events where slug='halloween-2026'),51));
 for t in select c.* from public.event_sms_current c join public.recruitment_events e on e.id=c.event_id where e.slug='halloween-2026' and c.category='payment' and c.language in ('ko','en') loop
  old_text:=case t.language when 'ko' then '참가비 입금 확인 및 운영진 승인 후 최종 참가가 확정됩니다.' else 'Your spot will be officially confirmed once your payment and participation have been approved.' end;
  new_text:=case t.language when 'ko' then E'참가비 입금이 확인되면 참가가 확정됩니다.\n한국 계좌가 없어 입금이 어려우신 경우, 현장에서 현금으로 결제하겠다고 문자로 알려주세요.' else E'Your spot will be confirmed once your payment is verified.\nIf you cannot transfer the fee because you do not have a Korean bank account, please let us know by text message that you will pay in cash at the venue.' end;
  if position(new_text in t.body)>0 then continue;end if;
  if position(old_text in t.body)=0 then raise exception 'Payment template changed; review before updating (%)',t.id;end if;
  insert into public.event_sms_templates(event_id,template_key,version,category,language,title,body,active,is_default,created_by)
  values(t.event_id,t.template_key,t.version+1,t.category,t.language,t.title,replace(t.body,old_text,new_text),t.active,t.is_default,null);
 end loop;
end $$;
commit;
