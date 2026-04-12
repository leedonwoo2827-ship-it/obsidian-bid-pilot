# Bid Intelligence — Obsidian Plugin

> 수주 정보 분석 대시보드 — 컨텍스트 관리, 브리핑 뷰어, 분석 리포트 시각화, Gemini AI 자동 분석

[bid-pilot](https://github.com/scottnaddle/bid-pilot) Claude Code 스킬 플러그인의 Obsidian 동반 플러그인입니다.
Claude Code에서 생성한 분석 결과를 Obsidian에서 시각화하고, Gemini AI로 컨텍스트 파일을 자동 분석합니다.

## 주요 기능

### 📂 컨텍스트 매니저
- `_context/` 폴더의 회사 데이터 현황을 한눈에 파악
- 카테고리별 파일 수, 최근 수정일 표시
- AI 분석 상태 확인 및 일괄 분석 실행

### 📊 브리핑 대시보드
- `/brief` 명령으로 생성된 일일 브리핑을 시각화
- 요약 카드 (전체 공고, 적합도 높음, 마감 임박)
- 공고 테이블, 시장 동향, 추천 액션 표시

### 📑 분석 리포트 뷰어
- `_analysis/` 폴더의 모든 분석 결과를 유형별 필터링
- 마크다운 미리보기
- 브리핑 / 수주 분석 / 공고 스캔 / 경쟁 분석 / 파이프라인 분류

### 🤖 Gemini AI 연동
- Google Gemini API로 컨텍스트 파일 자동 요약
- 파일별 카테고리, 태그, 핵심 엔티티 추출
- 분석 결과를 프로퍼티(frontmatter)에 자동 기록
- 새 파일 추가 시 자동 분석 (설정에서 on/off)

### 프로퍼티 자동 생성 예시

```yaml
---
type: context
category: company
summary: "데크만팩토리 2025년 IR보고서, AI 솔루션 사업 현황"
tags: [AI, SaaS, B2B, 공공조달]
entities: [데크만팩토리, 한국신용평가, 삼성증권]
relevance: "입찰 시 회사 역량 증빙 및 수행실적 참조 자료로 활용"
---
```

## 설정

플러그인 설정(Settings → Bid Intelligence)에서 구성할 수 있습니다:

| 항목 | 설명 |
|---|---|
| Gemini API 키 | Google AI Studio에서 발급받은 API 키 |
| Gemini 모델 | 2.0 Flash (무료) / 2.5 Flash / 2.5 Pro |
| 컨텍스트 자동 분석 | 파일 추가 시 자동 요약 on/off |
| 프로퍼티 자동 생성 | frontmatter 자동 기록 on/off |
| 관심 키워드 | 브리핑 검색 키워드 |
| 관심 발주처 | 모니터링 대상 기관 |

## 명령어

| 명령어 | 설명 |
|---|---|
| `컨텍스트 매니저 열기` | 좌측 사이드바에 컨텍스트 매니저 표시 |
| `브리핑 대시보드 열기` | 우측 사이드바에 브리핑 대시보드 표시 |
| `분석 리포트 뷰어 열기` | 우측 사이드바에 리포트 뷰어 표시 |
| `현재 파일 AI 분석` | 열린 파일을 Gemini로 분석, 프로퍼티 생성 |
| `컨텍스트 전체 분석` | _context/ 내 모든 MD 파일 일괄 분석 |

## 폴더 구조

```
vault/
  _context/           # 회사 데이터 (IR보고서, 제안서, CV 등)
    company/
    proposals/
    credentials/
    personnel/
    sector/
  _analysis/          # Claude Code 분석 결과
    brief-2026-04-12.md
    bid-analyze-사업명.md
    scan-2026-04-12.md
```

## 함께 사용하기

이 플러그인은 단독으로도 사용할 수 있지만, [bid-pilot](https://github.com/scottnaddle/bid-pilot) Claude Code 스킬과 함께 사용하면 최대 효과를 발휘합니다:

1. Claude Code에서 `/brief`, `/bid-analyze` 등 실행
2. 분석 결과가 `_analysis/` 폴더에 자동 저장
3. Obsidian에서 대시보드로 시각화하여 확인
4. Gemini AI가 추가 프로퍼티를 자동 생성

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
