<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 사용자 고정 Git 작업 규칙

이 사용자의 고정 작업 브랜치는 `feat/events-nakyung`이다. 이후 작업에도 재사용하고 삭제하지 않는다.
새 작업 브랜치 생성이 필요한 경우 사용자의 명시적인 브랜치 지정이 우선한다.

작업 시작 전 현재 브랜치를 확인하고, 이 사용자의 작업에서는 고정 작업 브랜치에서 최신 origin/main을 fetch·merge한다.
사용자나 다른 팀원의 미완료 변경은 보존한다. main에서 직접 구현하지 않는다.
작업 완료 시 본인 변경만 커밋하고, 최신 origin/main을 다시 반영한다.
충돌은 양쪽 의도를 보존해 해결하고 불확실하면 병합하지 말고 사용자에게 알린다.
테스트 후 고정 브랜치를 push하고 PR을 통해 main에 병합한다. 이 Git 흐름은 매번 별도 요청 없이 수행한다.
배포나 기능 활성화에 대해 사용자가 별도로 둔 제한은 유지한다.

금지: main 직접 작업·push, force push, reset --hard, 다른 팀원의 브랜치 수정, 충돌 시 다른 사람 코드 임의 삭제.
PR 병합 후에도 고정 작업 브랜치를 삭제하지 않는다.
