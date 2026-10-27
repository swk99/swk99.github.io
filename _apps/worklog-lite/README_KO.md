# Worklog Lite — 문서 + 업무 보드

Confluence의 공간·페이지·수정 이력과 Jira의 이슈·보드·백로그 흐름을 참고한 **개인용 로컬 앱**입니다. Atlassian 제품이나 공식 연동 프로그램이 아닙니다. 실제 회사 업무, 샘플 티켓, 기본 비밀번호 없이 시작합니다.

## Windows에서 사용

1. [GitHub Releases](https://github.com/swk99/swk99.github.io/releases)에서 **WorklogLite.exe**를 다운로드하세요. Windows x64용입니다.
2. 더블클릭하면 작은 실행 창과 기본 브라우저가 열립니다. **Python이나 Node.js를 별도로 설치할 필요가 없습니다.**
3. 첫 화면에서 사용할 아이디와 비밀번호(8자 이상)를 정하세요. 설치별로 계정이 생성되며 기본 계정은 없습니다.
4. `Create`에서 문서를 만들거나 `Board → Create issue`에서 티켓을 만드세요.
5. 사용하는 동안 실행 창을 열어 두세요. 종료하면 로컬 서버도 멈추고, 저장된 내용은 다음 실행에 남습니다.

이미 실행 중이면 새로 실행하지 말고 기존 Worklog Lite 창에서 **Open workspace**를 누르세요. 브라우저가 자동으로 열리지 않아도 이 버튼으로 열 수 있습니다. 기본 주소는 `http://127.0.0.1:8766`이며, 포트가 사용 중이면 빈 포트를 선택하고 실행 창에 표시합니다.

앱은 Windows 10/11 x64 및 Windows Server의 데스크톱 세션을 대상으로 합니다. 이 초기 배포본은 코드 서명 인증서로 서명되지 않았습니다. 조직의 실행 정책에 따라 승인된 방식으로 사용하세요.

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 문서 | 공간, 부모/자식 페이지, Markdown 편집과 미리보기, 제목·본문·라벨 검색 |
| 문서 이력 | 수정 버전, 내용 확인, 이전 버전을 새 버전으로 복원, 동시 수정 충돌 방지 |
| 템플릿 | 빈 페이지, 프로젝트, 런북, 장애 보고, 의사결정, 일지, 인수인계 |
| 업무 관리 | Task / Bug / Story, 요약·설명, 우선순위, 담당자 이름, 기한, 라벨 |
| 워크플로 | Backlog → To do → In progress → In review → Done |
| 보드 | 드래그 이동, 텍스트·우선순위 필터, 카드 상세 편집 |
| 백로그 | 아직 계획하지 않은 업무 목록, To do로 이동 |
| 연결 | 티켓에서 관련 문서 열기, 문서에서 연결된 티켓 확인/생성 |
| 삭제 | 문서·티켓 휴지통 및 복원 |
| 첨부·백업 | 문서당 파일 첨부(파일별 15 MB), 전체 SQLite 백업, Markdown + 이슈 JSON 내보내기 |

공간은 문서와 보드가 함께 사용하는 구분 단위입니다. 왼쪽에서 공간을 선택한 뒤 Board/Backlog를 열면 그 공간의 업무가 보입니다. 담당자는 이름을 기록하는 필드이며 사용자 초대나 이메일 발송 기능은 없습니다. 티켓의 모든 변경은 Activity에 기록됩니다.

문서 편집기는 가벼운 Markdown 부분집합을 지원합니다. 제목, 굵게, 기울임, 인용, 단순 목록, 체크리스트, 코드 블록, 파이프 표와 링크를 사용할 수 있습니다. 중첩 목록·고급 HTML·Mermaid·인라인 이미지·실시간 공동편집은 포함하지 않습니다. 체크리스트는 Edit에서 `[ ]` / `[x]`를 변경하세요.

## 데이터와 로그인

정식 Windows 앱의 데이터 위치:

```text
%LOCALAPPDATA%\WorklogLite\
  worklog.sqlite3    문서·티켓·이력·첨부
  auth.json         계정명과 비밀번호 해시
  application.lock  중복 실행 방지용 파일
```

문서 내용은 GitHub에 업로드되지 않습니다. GitHub는 소스와 다운로드 파일만 제공합니다. 프로그램 실행 시 외부 API, CDN, 분석 도구, 외부 폰트를 호출하지 않습니다. 브라우저의 저장/인쇄 다운로드 경로는 브라우저 설정에 따릅니다.

로그인으로 문서·티켓·첨부·백업 API를 보호합니다. 비밀번호는 무작위 salt와 PBKDF2-HMAC-SHA256 해시(600,000회)로 저장합니다. 세션은 최대 8시간이며, 서버 재시작/로그아웃으로 종료됩니다. 5분 안에 로그인 실패가 5번 쌓이면 60초간 제한됩니다. 쿠키는 HttpOnly / SameSite=Strict이며 localhost HTTP 전용입니다.

**로컬 로그인은 DB 파일 암호화가 아닙니다.** Windows 계정으로 해당 폴더를 직접 읽을 수 있는 사람이나 프로그램은 파일에 접근할 수 있습니다. 앱은 `127.0.0.1`에서만 수신하며, 사내망/인터넷 공개 서버로 사용하기 위한 제품이 아닙니다.

저장 전 문서 초안은 현재 브라우저 탭의 sessionStorage에만 임시 보관됩니다. 로그아웃하면 해당 위키의 이 탭 초안이 지워집니다. **Save page가 정식 저장**입니다. 티켓 편집창은 별도 초안 자동 저장을 하지 않습니다.

## 백업 / 복구 / 계정 재설정

브라우저의 **Backup workspace** 또는 실행 창의 **Backup**에서 전체 SQLite 백업을 저장하세요. 문서·티켓·이력·휴지통·첨부가 함께 들어갑니다. `auth.json`은 포함되지 않으므로 다른 컴퓨터에 계정까지 옮기려면 앱 종료 후 별도로 복사하거나 새 계정을 설정하세요. Markdown ZIP은 읽기/이동용이며 전체 복구용이 아닙니다.

복구할 때는 앱을 종료한 뒤 PowerShell에서 실행하세요.

```powershell
.\WorklogLite.exe --restore "C:\Backups\worklog-lite-backup.sqlite3"
```

앱이 복구 확인 창을 표시합니다. 현재 DB는 `before-restore-<id>.sqlite3`로 먼저 보존됩니다. 이 앱에서 만든 신뢰하는 백업을 사용하세요. 복구는 로그인 설정을 변경하지 않습니다. 기존 Worklog Wiki의 v1 백업을 이 앱의 v2 DB에 바로 덮어쓰는 기능은 제공하지 않습니다. 기존 문서는 Markdown으로 가져올 수 있습니다.

계정을 재설정할 때도 앱을 종료하고 실행하세요.

```powershell
.\WorklogLite.exe --reset-login
```

아이디와 새 비밀번호를 로컬 대화상자에서 입력합니다. 원문 비밀번호를 명령줄 인자로 전달하지 않습니다.

데이터 폴더를 별도로 지정하려면 실행/복구/재설정에 같은 `--data-dir "D:\WorklogData"` 옵션을 사용하세요. 실행 파일을 새 버전으로 교체해도 기본 데이터 폴더는 유지됩니다.

## 소스 실행과 Windows 빌드

소스 실행은 Python 3.11 이상이 필요합니다.

```powershell
cd _apps\worklog-lite
python desktop.py
```

Tkinter 없이 브라우저 서버만 사용하려면 `python server.py`를 실행하세요. 이 개발 모드는 소스 폴더 아래 `data`를 사용합니다. 정식 EXE/desktop.py의 기본 AppData 경로와 구분됩니다.

Windows에서 실행 파일 만들기:

```powershell
.\build-windows.ps1
```

빌드에만 PyInstaller가 필요합니다. 결과는 `dist\WorklogLite.exe`입니다. GitHub Actions는 Windows에서 통합 테스트 → EXE 빌드 → **실제 EXE의 임시 데이터 테스트** → 다운로드 Release 순서로 실행합니다. EXE 테스트는 UI 리소스, Tkinter 초기화, 빈 초기 상태, 계정 설정, 문서·티켓 연결, 상태 변경, 충돌 방지, 첨부, 백업/복구, 내보내기, 로그아웃을 확인합니다. Windows 사용자의 모든 브라우저/보안 환경을 검증한 것은 아닙니다.

## 참고한 공식 문서

- [Confluence Pages API](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/)
- [Confluence technical documentation](https://support.atlassian.com/confluence-cloud/docs/use-confluence-for-technical-documentation/)
- [Jira Board API](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/)
- [Jira Backlog API](https://developer.atlassian.com/cloud/jira/software/rest/api-group-backlog/)
- [PyInstaller](https://pyinstaller.org/en/stable/)

원본 제품의 브랜드 자산이나 서버 코드를 복사하지 않은 독립 구현입니다. Jira 스프린트·에픽·JQL, 다중 사용자 권한·SSO, Atlassian 동기화는 이 경량 버전에 포함하지 않습니다.
