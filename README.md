# Bid Intelligence — Obsidian Plugin

> 수주 제안 AI 작성 파트너 — 컨텍스트 관리, 멀티턴 채팅, RAG 근거 검색, 적용 편집, 멀티미디어 컨텍스트, MCP 도구 연동

[bid-pilot](https://github.com/scottnaddle/bid-pilot) Claude Code 스킬의 Obsidian 동반 플러그인입니다.
회사 자료·공고문·경쟁사 정보를 기반으로 Gemini와 대화하며 제안서를 작성하고, AI 제안을 노트에 바로 적용합니다.

## 주요 기능

### 💬 수주 AI 채팅 (ChatView)
- 우측 사이드바에서 Gemini와 멀티턴 스트리밍 대화
- **상황별 컨텍스트 pin**: 현재 노트·폴더를 칩으로 부착
- **중단 버튼**: 스트리밍 응답을 즉시 취소
- **대화 히스토리 제한**(설정으로 조정)으로 토큰 사용 통제

### 🔍 RAG — 자동 근거 검색
- `_context/` 폴더를 Gemini `text-embedding-004`로 인덱싱 (JSON 벡터 저장소, `.obsidian/plugins/bid-intelligence/vectors.json`)
- 채팅 질문마다 **코사인 유사도 top-K 청크** 자동 주입
- 파일 생성/수정/삭제/이름변경 시 자동 증분 인덱싱
- 사용자 메시지에 `🔍 <파일경로>`로 참조 표시

### 📝 Apply Edit — AI 편집 제안 적용
- AI 응답에 `<<<EDIT …>>>` 블록이 포함되면 "📝 적용" 버튼 자동 생성
- **Diff 미리보기 모달**에서 변경 내용을 ±3줄 컨텍스트로 검토
- 승인 시 `vault.modify`로 노트에 반영
- 세 가지 모드: `replace`(전체) / `append`(끝에 추가) / `section`(특정 헤딩 교체)

### 🎬 멀티미디어 컨텍스트
- **이미지 분석** (차트·스크린샷 → 노트 반영): 채팅 입력창에 **Ctrl+V** 또는 "🖼️ 이미지" 버튼으로 첨부. Gemini 멀티모달이 차트·표·다이어그램을 읽어 Apply Edit으로 노트에 바로 반영. 2048px 자동 리사이즈로 토큰 절약.
- **YouTube 자막**: 입력창에 URL 붙여넣기만 하면 자동 자막 fetch → 프롬프트에 포함 (API 키 불필요, 언어 우선순위 설정)

### 🔌 MCP (Model Context Protocol)
- HTTP/JSON-RPC 2.0 기반 MCP 서버 연동
- Gemini function calling 루프로 도구 자동 호출 (예: Slack 라우팅, 캘린더 조회)
- 설정에 서버 목록(JSON) 입력, "도구 조회" 버튼으로 연결 확인

### 🛡️ AI Slop 방지 가드레일
- `_memory/quality-guardrails.md`의 "작성 원칙" 섹션을 시스템 프롬프트에 자동 주입
- 근거 없는 기관명·금액·실적 생성 차단
- 사용자 검증 체크리스트 제공

### 📂 컨텍스트 매니저
- `_context/` 폴더의 회사 데이터 현황을 한눈에 파악
- 카테고리별 파일 수, 최근 수정일 표시
- AI 분석 상태 확인 및 일괄 분석 실행

### 🤖 Gemini AI 연동 (frontmatter 자동 생성)
- Google Gemini API로 컨텍스트 파일 자동 요약
- 파일별 카테고리, 태그, 핵심 엔티티 추출
- 분석 결과를 프로퍼티(frontmatter)에 자동 기록

### 프로퍼티 자동 생성 예시

```yaml
---
type: context
category: company
summary: "회사 2025년 IR보고서, AI 솔루션 사업 현황"
tags: [AI, SaaS, B2B, 공공조달]
entities: [회사명, 한국신용평가, 삼성증권]
relevance: "입찰 시 회사 역량 증빙 및 수행실적 참조 자료로 활용"
---
```

## 설정

Settings → Bid Intelligence에서 구성할 수 있습니다.

| 섹션 | 항목 | 설명 |
|---|---|---|
| 📁 프로젝트 경로 | 컨텍스트/분석 폴더 | 볼트 내 상대 경로 (v1.1) |
| 🤖 AI | Gemini API 키, 모델 | 2.5 Flash / Flash-Lite / Pro |
| ⚙️ 자동화 | 컨텍스트 자동 분석, frontmatter 자동 생성 | 파일 추가 시 자동 처리 |
| 💬 채팅 | 히스토리 유지 턴 수, 시스템 프롬프트 재정의 | 기본 20턴 |
| 🔍 RAG | 활성화, Top K, 재인덱싱 | 기본 Top 5 |
| 🔌 MCP 서버 | 서버 목록(JSON), 도구 조회 | HTTP/SSE 전송만 지원 |
| 🎬 멀티미디어 | YouTube 자막 언어 우선순위 | 기본 `ko,en` |
| 📋 브리핑 | 관심 키워드/발주처 | (레거시 — 뷰 숨김) |
| 🔧 진단 | API 연결 테스트 | Gemini 연결 확인 |

## 명령어

`Ctrl+P` → `bid` 검색:

| 명령어 | 설명 |
|---|---|
| 컨텍스트 매니저 열기 | 좌측 사이드바 컨텍스트 매니저 |
| 수주 AI 채팅 열기 | 우측 사이드바 채팅 뷰 |
| 현재 파일 AI 분석 | 열린 파일을 Gemini로 분석, 프로퍼티 생성 |
| 컨텍스트 전체 분석 | `_context/` 내 모든 MD 파일 일괄 분석 |
| 컨텍스트 볼트 재인덱싱 (RAG) | RAG 벡터 DB 재생성 |

> ℹ️ 이전 버전의 "브리핑 대시보드 열기"·"분석 리포트 뷰어 열기" 명령은 제거되었습니다. 뷰 클래스는 코드에 남아 있어 향후 부활 가능합니다.

## 폴더 구조

```
vault/
  _context/            # 회사 데이터 (IR보고서, 제안서, CV 등) — RAG 인덱싱 대상
    company/
    proposals/
    credentials/
    personnel/
    sector/
  _analysis/           # Claude Code 분석 결과
    brief-2026-04-12.md
    bid-analyze-사업명.md
  _memory/             # AI 운영 규범 (플러그인이 자동 참조)
    quality-guardrails.md
    references/
      ai-slop-essay.md
```

## 함께 사용하기

이 플러그인은 단독으로도 사용할 수 있지만, [bid-pilot](https://github.com/scottnaddle/bid-pilot) Claude Code 스킬과 함께 사용하면 최대 효과를 발휘합니다:

1. Claude Code에서 `/brief`, `/bid-analyze` 등 실행
2. 분석 결과가 `_analysis/` 폴더에 자동 저장
3. Obsidian 채팅에서 RAG로 근거를 불러오며 제안서 작성
4. Apply Edit으로 AI 제안을 노트에 바로 반영

## 빌드

```bash
npm install
npm run build
```

개발 모드:
```bash
npm run dev
```

## 라이선스

MIT
