import {test} from 'node:test';
import assert from 'node:assert/strict';
import {season9LanguageHref} from '../src/lib/season9-navigation.ts';
import {applicantGenderLabel} from '../src/lib/season9-gender.ts';
test('language switches preserve attribution and application anchor without carrying private query fields',()=>{assert.equal(season9LanguageHref(false,'?utm_source=instagram&utm_campaign=fall&contact=private','#application'),'/season9/en?utm_source=instagram&utm_campaign=fall#application');assert.equal(season9LanguageHref(true,'?utm_medium=paid_social','#s9-program'),'/season9?utm_medium=paid_social#s9-program');});
test('admin labels handle old records and all optional gender values consistently',()=>{for(const [value,label]of [[null,'미입력'],['','미입력'],['male','남성'],['여성 / Female','여성'],['prefer_not_to_say','응답하지 않음'],['self_describe:나의 표현','직접 입력: 나의 표현']])assert.equal(applicantGenderLabel(value),label);});
