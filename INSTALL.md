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
| Gemini 2.0 Flash | 빠름, 일반 분석 | 무료 |
| Gemini 2.5 Flash | 최신, 균형 | 무료 (제한적) |
| Gemini 2.5 Pro | 고품질, 복잡한 분석 | 유료 |

대부분의 경우 **Gemini 2.0 Flash**로 충분합니다.

## 초기 설정

### _context/ 폴더 준비

vault 루트에 `_context/` 폴더를 만들고 회사 데이터를 넣으세요:

```
_context/
  회사소개서.md          # 필수: 회사 개요
  IR보고서-2025.pdf      # 권장: 최신 IR
  proposals/
    과거-제안서-1.md     # 권장: 과거 제안서
  personnel/
    홍길동-CV.md         # 선택: 핵심 인력
```

### 자동 분석 활성화

1. 설정 → Bid Intelligence → "컨텍스트 자동 분석" 켜기
2. `_context/`에 MD 파일을 넣으면 자동으로 요약 + 프로퍼티 생성
3. 또는 명령어 팔레트에서 "컨텍스트 전체 분석" 실행

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
