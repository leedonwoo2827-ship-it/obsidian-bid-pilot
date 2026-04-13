# `_memory/` — 플러그인 규범 저장소

이 폴더는 bid-intelligence 플러그인이 **런타임에서 참조하거나 운영 규범으로 삼는 문서**를 모아둡니다. `_context/`(사용자의 수주 원자료)와는 역할이 다릅니다 — 여기 있는 문서는 AI 출력 품질을 통제하고 사용자 검수 기준을 정의합니다.

## 구성

| 파일 | 용도 | 런타임 소비 방식 |
|---|---|---|
| [quality-guardrails.md](quality-guardrails.md) | AI Slop 방지 운영 규범, 작성 원칙, 검증 체크리스트 | ChatView가 "작성 원칙" 섹션을 시스템 프롬프트에 자동 주입 |
| [references/ai-slop-essay.md](references/ai-slop-essay.md) | AI Slop 학술 배경 에세이 (원본 자료) | 수동 참조 전용, 자동 주입 없음 |
| safetymodel.pdf | 안전 모델 관련 자료 (이미지 PDF — 텍스트 변환 대기 중) | 현재 미소비. 향후 `safety-model.md`로 재작성 예정 |

## 파일 추가 원칙

- **자동 주입 대상**: ChatView·분석 파이프라인이 시스템 프롬프트에 포함할 규범만. 이 경우 사용하는 소스코드 경로를 이 README에 반드시 기록.
- **참조 자료**: 배경·근거 문서는 `references/` 하위에. 자동 주입하지 않음.
- **민감 자료 금지**: API 키·실제 거래처 정보 등은 절대 이곳에 두지 않습니다 — 이 폴더는 git에 커밋됩니다.

## 현재 자동 주입 연결

- ChatView는 현재 [DEFAULT_CHAT_SYSTEM_PROMPT](../src/views/ChatView.ts)를 인라인 상수로 사용합니다. quality-guardrails.md의 "작성 원칙" 섹션과 **동일한 내용**으로 유지되어야 하며, 한쪽을 고치면 다른 쪽도 갱신하십시오. (차후 자동 로드 훅으로 일원화 예정 — `loadGuardrails()` 유틸 후속 작업)
