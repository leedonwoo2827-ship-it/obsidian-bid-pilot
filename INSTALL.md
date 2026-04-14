# 설치 가이드

## 방법 1: 수동 설치

### 1. 릴리스 다운로드

[Releases](https://github.com/scottnaddle/obsidian-bid-pilot/releases) 페이지에서 최신 버전을 다운로드합니다:

- `main.js`
- `manifest.json`
- `styles.css`

### 2. 플러그인 폴더에 복사

Obsidian vault의 플러그인 폴더에 넣습니다:

```
내_볼트/.obsidian/plugins/bid-intelligence/
  ├── main.js
  ├── manifest.json
  └── styles.css
```

폴더가 없으면 `bid-intelligence` 폴더를 새로 만드세요.

### 3. 플러그인 활성화

1. Obsidian 설정 → 커뮤니티 플러그인
2. "제한 모드" 비활성화 (처음 사용 시)
3. 설치된 플러그인 목록에서 **Bid Intelligence** 활성화

## 방법 2: 소스에서 빌드

```bash
# 저장소 클론
git clone https://github.com/scottnaddle/obsidian-bid-pilot.git

# 의존성 설치
cd obsidian-bid-pilot
npm install

# 빌드
npm run build

# 결과물을 Obsidian vault로 복사
cp main.js manifest.json styles.css 내_볼트/.obsidian/plugins/bid-intelligence/
```

## 방법 3: BRAT 플러그인 사용

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인이 설치되어 있다면:

1. BRAT 설정 → Add Beta Plugin
2. `scottnaddle/obsidian-bid-pilot` 입력
3. 자동 설치 및 업데이트

## Gemini API 키 설정

AI 분석 기능을 사용하려면 Gemini API 키가 필요합니다.

### 1. API 키 발급

1. [Google AI Studio](https://aistudio.google.com/) 접속
2. 좌측 메뉴에서 "Get API key" 클릭
3. "Create API key" 클릭
4. 키를 복사

무료 등급으로도 충분히 사용할 수 있습니다 (분당 15회 요청).

### 2. 플러그인에 키 입력

1. Obsidian 설정 → Bid Intelligence
2. "Gemini API 키" 필드에 키 입력
3. "테스트" 버튼으로 연결 확인

### 3. 모델 선택

| 모델 | 특징 | 비용 |
|---|---|---|
| Gemini 2.5 Flash | 빠름, 균형 (권장 기본) | 무료 (제한적) |
| Gemini 2.5 Flash-Lite | 가장 저렴 | 무료 |
| Gemini 2.5 Pro | 고품질, 복잡한 분석 | 유료 |

대부분의 경우 **Gemini 2.5 Flash**로 충분합니다. 임베딩(RAG)은 별도 `text-embedding-004` 모델을 자동 사용하며 동일 API 키를 재사용합니다.

> 💡 **무료 티어 사용자 팁**: 기본은 Flash로 두고, 복잡한 차트 이미지 분석이 필요할 때만 Pro로 임시 전환하세요. 자세한 전략은 [플러그인_설정매뉴얼.md](플러그인_설정매뉴얼.md#-무료-티어-운영-가이드-중요)의 "무료 티어 운영 가이드" 참조.

## 초기 설정

### 1. 프로젝트 경로 설정 (v1.1)

Settings → Bid Intelligence → 📁 프로젝트 경로에서:
- **컨텍스트 폴더 경로**: 회사 자료가 있는 경로 (예: `_context` 또는 `bid-pilot/_context`)
- **분석 결과 폴더 경로**: 분석 리포트가 저장될 경로 (예: `_analysis`)

자세한 내용은 [플러그인_설정매뉴얼.md](플러그인_설정매뉴얼.md)를 참조하세요.

### 2. _context/ 폴더 준비

설정한 컨텍스트 폴더에 회사 데이터를 넣으세요:

```
_context/
  회사소개서.md          # 필수: 회사 개요
  IR보고서-2025.pdf      # 권장: 최신 IR
  proposals/
    과거-제안서-1.md     # 권장: 과거 제안서
  personnel/
    홍길동-CV.md         # 선택: 핵심 인력
```

### 3. 자동 분석 활성화 (frontmatter)

1. Settings → ⚙️ 자동화 → "컨텍스트 자동 분석" 켜기
2. 컨텍스트 폴더에 MD 파일을 넣으면 자동으로 요약 + 프로퍼티 생성
3. 또는 명령어 팔레트에서 "컨텍스트 전체 분석" 실행

### 4. RAG 벡터 인덱싱 (채팅 사용 전)

채팅이 근거를 자동으로 가져오려면 볼트 인덱싱이 필요합니다:

1. Settings → 🔍 RAG → "재인덱싱" 버튼 클릭, 또는
2. 명령 팔레트 → **컨텍스트 볼트 재인덱싱 (RAG)** 실행
3. 완료 후 `.obsidian/plugins/bid-intelligence/vectors.json` 생성 확인

파일 생성·수정·이름변경·삭제 시에는 **자동으로 증분 인덱싱**되므로 재실행이 거의 필요 없습니다.

### 5. 채팅 시작

1. 명령 팔레트 → **수주 AI 채팅 열기** (또는 우측 사이드바 💬 리본)
2. "📎 현재 노트" 버튼으로 참조할 노트를 핀하거나, RAG가 자동으로 근거를 불러옵니다
3. 질문을 입력하고 Ctrl+Enter로 전송
4. AI가 편집을 제안하면 "📝 적용" 버튼 → diff 검토 → 승인

### 6. (선택) MCP 서버 연결

외부 도구(Slack 라우팅, 캘린더 조회 등)를 쓰려면:

1. Settings → 🔌 MCP 서버 → JSON에 서버 정보 입력:
   ```json
   [{"name":"slack","url":"https://mcp.example.com/slack","enabled":true,"authHeader":"Bearer xxx"}]
   ```
2. "도구 조회" 버튼으로 연결 확인 (개발자 콘솔 확인)
3. 채팅에서 자연어로 도구 호출 요청 ("#general 채널에 오늘 공고 요약 보내줘")

**제약**: HTTP/SSE 전송 MCP 서버만 지원. stdio 전송은 미지원.

## 문제 해결

### 플러그인이 보이지 않는 경우
- `.obsidian/plugins/bid-intelligence/` 경로에 3개 파일이 있는지 확인
- Obsidian을 완전히 종료 후 재시작
- 커뮤니티 플러그인 → "제한 모드"가 꺼져 있는지 확인

### Gemini API 오류
- API 키가 올바른지 확인 (설정 → 테스트 버튼)
- 무료 등급 한도 초과 시 잠시 대기 (분당 15회)
- 네트워크 연결 확인

### 프로퍼티가 생성되지 않는 경우
- 설정에서 "프로퍼티 자동 생성"이 켜져 있는지 확인
- 마크다운(.md) 파일만 지원됩니다
- 파일 내용이 너무 짧으면 (50자 미만) 건너뜁니다
