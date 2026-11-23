# Cloudflare Workers 및 D1 무료 플랜 테스트

이 Worker는 승인된 테스트 요청에만 응답하며 문서용 가상 IP 두 개만 기록합니다. 후성 홈페이지, 광고 계정, 실제 방문자 IP와 연결되지 않습니다. 로그 조회에는 테스트 비밀키가 필요합니다. 7일이 지난 테스트 행은 다음 정상 조회 또는 기록 시 삭제됩니다.

## 로컬 실행

Node.js와 Wrangler CLI가 필요합니다. 테스트용 비밀키를 `.dev.vars`에 `TEST_TOKEN=...` 형식으로 설정한 후 실행합니다. 비밀키 파일을 커밋하지 않습니다.

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler dev --local
```

별도 셸에서 같은 테스트 비밀키를 환경 변수 `HUSEONG_TEST_TOKEN`에 넣어 실행합니다.

```sh
curl -i -X POST -H "Authorization: Bearer $HUSEONG_TEST_TOKEN" http://localhost:8787/test/first
curl -i -X POST -H "Authorization: Bearer $HUSEONG_TEST_TOKEN" http://localhost:8787/test/first
curl -fsS -H "Authorization: Bearer $HUSEONG_TEST_TOKEN" http://localhost:8787/test/visits
```

## 무료 플랜 원격 테스트

사무소가 관리하는 Cloudflare 계정에서 Workers Free 플랜을 사용합니다. 테스트용 D1을 만든 다음 설정 파일의 로컬 전용 ID를 발급된 D1 ID로 바꿉니다. 원격 마이그레이션을 적용하고 Worker를 배포한 뒤 Cloudflare Worker 시크릿으로 `TEST_TOKEN`을 설정합니다. 비밀키를 설정하기 전에는 모든 요청이 404로 처리됩니다. Worker 주소에서 위 테스트를 반복합니다. 이 테스트에서는 홈페이지의 수집 URL을 비워 둡니다.
