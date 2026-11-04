examples = {
'class-and-object': '''class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

seonwoo = Account("선우", 30)
koala = Account("코돌이", 50)
print(seonwoo.balance, koala.balance)  # 30 50''',
'encapsulation': '''class Account:
    def __init__(self, balance):
        if balance < 0:
            raise ValueError("잔액은 음수일 수 없어요")
        self._balance = balance

    def withdraw(self, amount):
        if amount <= 0 or amount > self._balance:
            raise ValueError("출금할 수 없는 금액이에요")
        self._balance -= amount

account = Account(50)
account.withdraw(20)
print(account._balance)  # 학습용 확인: 30''',
'polymorphism': '''class Email:
    def send(self, text):
        return f"이메일: {text}"

class SMS:
    def send(self, text):
        return f"문자: {text}"

for sender in [Email(), SMS()]:
    print(sender.send("접수 완료"))''',
'composition': '''class CSVExporter:
    def export(self, rows):
        return "\\n".join(",".join(row) for row in rows)

class Report:
    def __init__(self, exporter):
        self.exporter = exporter

    def render(self, rows):
        return self.exporter.export(rows)

print(Report(CSVExporter()).render([["name", "amount"]]))''',
'factory-method': '''class CSVExporter:
    def export(self):
        return "CSV 보고서"

class ReportJob:
    def create_exporter(self):
        raise NotImplementedError

    def run(self):
        exporter = self.create_exporter()
        return exporter.export()

class CSVJob(ReportJob):
    def create_exporter(self):
        return CSVExporter()

print(CSVJob().run())''',
'abstract-factory': '''class LightButton:
    label = "밝은 버튼"

class LightDialog:
    label = "밝은 창"

class LightFactory:
    def button(self):
        return LightButton()
    def dialog(self):
        return LightDialog()

# 화면은 같은 팩토리에서 제품 묶음을 받아요.
def render(factory):
    return factory.button().label, factory.dialog().label

print(render(LightFactory()))''',
'builder': '''class ReportBuilder:
    def __init__(self):
        self.parts = []
    def title(self, text):
        self.parts.append(f"제목: {text}")
        return self
    def note(self, text):
        self.parts.append(f"메모: {text}")
        return self
    def build(self):
        return "\\n".join(self.parts)

print(ReportBuilder().title("월간 보고서").note("검증 완료").build())''',
'prototype': '''from copy import deepcopy

template = {"title": "기본", "charts": ["잔액"]}
team = deepcopy(template)
team["title"] = "분석팀"
team["charts"].append("거래량")
print(template["charts"])  # ['잔액']
print(team["charts"])      # ['잔액', '거래량']''',
'singleton': '''# 단일 스레드 학습용 예시예요.
# 운영 코드에서는 동시 초기화와 테스트 격리를 고려해요.
class Settings:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

print(Settings() is Settings())  # True''',
'adapter': '''class VendorSMS:
    def dispatch(self, number, body):
        return f"{number}: {body}"

class SMSAdapter:
    def __init__(self, vendor, number):
        self.vendor = vendor
        self.number = number
    def send(self, text):
        return self.vendor.dispatch(self.number, text)

sender = SMSAdapter(VendorSMS(), "070-0000")
print(sender.send("접수 완료"))''',
'bridge': '''class PlainRenderer:
    def render(self, title):
        return f"문서: {title}"

class BracketRenderer:
    def render(self, title):
        return f"[{title}]"

class MonthlyReport:
    def __init__(self, renderer):
        self.renderer = renderer
    def show(self):
        return self.renderer.render("월간 보고서")

for renderer in [PlainRenderer(), BracketRenderer()]:
    print(MonthlyReport(renderer).show())''',
'composite': '''class File:
    def __init__(self, size):
        self.bytes = size
    def size(self):
        return self.bytes

class Folder:
    def __init__(self, children):
        self.children = children
    def size(self):
        return sum(child.size() for child in self.children)

root = Folder([File(10), Folder([File(20), File(30)])])
print(root.size())  # 60''',
'decorator': '''class Sender:
    def send(self, text):
        return f"전송: {text}"

class LoggingSender:
    def __init__(self, wrapped):
        self.wrapped = wrapped
    def send(self, text):
        print("발송 호출 기록")
        return self.wrapped.send(text)

print(LoggingSender(Sender()).send("완료"))''',
'facade': '''def reconcile():
    return [10, 20]

def validate(rows):
    return all(value >= 0 for value in rows)

class MonthEnd:
    def close(self):
        rows = reconcile()
        if not validate(rows):
            raise ValueError("검증 실패")
        return f"합계 {sum(rows)}"

print(MonthEnd().close())''',
'flyweight': '''from dataclasses import dataclass

@dataclass(frozen=True)
class Icon:
    shape: str

shared_icon = Icon("동그라미")
markers = [(10, 20, shared_icon), (30, 40, shared_icon)]
print(markers[0][2] is markers[1][2])  # True
# 좌표는 개별 상태, 아이콘은 공유 상태예요.''',
'proxy': '''class Report:
    def read(self):
        return "월간 합계"

class ReportProxy:
    def __init__(self, report, allowed):
        self.report, self.allowed = report, allowed
    def read(self):
        if not self.allowed:
            raise PermissionError("접근 불가")
        return self.report.read()

print(ReportProxy(Report(), True).read())''',
'chain-of-responsibility': '''def authenticated(request):
    return request["user"] is not None

def within_limit(request):
    return request["amount"] <= 100

def handle(request, checks):
    for check in checks:
        if not check(request):
            return "중단"
    return "접수"

print(handle({"user": "선우", "amount": 30},
             [authenticated, within_limit]))''',
'command': '''class AddNote:
    def __init__(self, notes, text):
        self.notes, self.text = notes, text
    def execute(self):
        self.notes.append(self.text)

notes = []
queue = [AddNote(notes, "검토하기"), AddNote(notes, "발송하기")]
for command in queue:
    command.execute()
print(notes)''',
'iterator': '''def records(pages):
    for page in pages:
        for row in page:
            yield row

for row in records([["A", "B"], ["C"]]):
    print(row)
# 호출자는 페이지 내부 인덱스를 관리하지 않아요.''',
'mediator': '''class Button:
    enabled = False

class FormMediator:
    def __init__(self, button):
        self.button = button
    def income_changed(self, value):
        self.button.enabled = value > 0

button = Button()
form = FormMediator(button)
form.income_changed(2000)
print(button.enabled)  # True''',
'memento': '''class Editor:
    def __init__(self):
        self.text = "초안"
    def snapshot(self):
        return self.text  # 불변 문자열을 스냅샷으로 사용
    def restore(self, snapshot):
        self.text = snapshot

editor = Editor()
saved = editor.snapshot()
editor.text = "수정본"
editor.restore(saved)
print(editor.text)  # 초안''',
'observer': '''class Order:
    def __init__(self):
        self.listeners = []
    def subscribe(self, listener):
        self.listeners.append(listener)
    def complete(self):
        for listener in self.listeners:
            listener("주문 완료")

order = Order()
order.subscribe(lambda event: print("화면:", event))
order.subscribe(lambda event: print("이메일:", event))
order.complete()''',
'state': '''class Draft:
    def submit(self, app):
        app.state = Reviewing()
        return "심사 시작"

class Reviewing:
    def submit(self, app):
        return "이미 심사 중"

class Application:
    def __init__(self):
        self.state = Draft()
    def submit(self):
        return self.state.submit(self)

app = Application()
print(app.submit())
print(app.submit())''',
'strategy': '''def shortest(routes):
    return min(routes, key=lambda r: r["distance"])

def fewest_transfers(routes):
    return min(routes, key=lambda r: r["transfers"])

def choose(routes, strategy):
    return strategy(routes)

routes = [{"distance": 5, "transfers": 2},
          {"distance": 8, "transfers": 0}]
print(choose(routes, shortest))
print(choose(routes, fewest_transfers))''',
 'template-method': '''class ImportJob:
    def read(self):
        raise NotImplementedError
    def run(self):
        rows = self.read()
        valid = [row for row in rows if row]
        return len(valid)

class ListImport(ImportJob):
    def read(self):
        return ["A", "", "B"]

print(ListImport().run())  # 2''',
'visitor': '''class Paragraph:
    def __init__(self, text):
        self.text = text
    def accept(self, visitor):
        return visitor.visit_paragraph(self)

class CharacterCount:
    def visit_paragraph(self, paragraph):
        return len(paragraph.text)

class PlainText:
    def visit_paragraph(self, paragraph):
        return paragraph.text

node = Paragraph("안녕하세요")
print(node.accept(CharacterCount()))
print(node.accept(PlainText()))''',
'extract-method': '''# 전: 한 함수에서 합계를 계산
# total = sum(row["amount"] for row in rows)

# 후: 계산 목적에 이름을 붙임
def total_amount(rows):
    return sum(row["amount"] for row in rows)

rows = [{"amount": 10}, {"amount": 20}]
print(total_amount(rows))  # 30''',
'replace-nested-conditional-with-guard-clauses': '''def can_apply(member):
    if member is None:
        return False
    if member["suspended"]:
        return False
    return member["age"] >= 18

print(can_apply({"suspended": False, "age": 27}))''',
'introduce-parameter-object': '''from dataclasses import dataclass
from datetime import date

@dataclass(frozen=True)
class DateRange:
    start: date
    end: date
    def __post_init__(self):
        if self.start > self.end:
            raise ValueError("날짜 순서를 확인해요")

period = DateRange(date(2026, 1, 1), date(2026, 1, 31))
print(period.start)''',
'replace-magic-number-with-symbolic-constant': '''SECONDS_PER_DAY = 24 * 60 * 60

def days_to_seconds(days):
    return days * SECONDS_PER_DAY

print(days_to_seconds(2))  # 172800''',
'replace-inheritance-with-delegation': '''class Queue:
    def __init__(self):
        from collections import deque
        self._items = deque()
    def put(self, item):
        self._items.append(item)
    def get(self):
        return self._items.popleft()

queue = Queue()
queue.put("A")
print(queue.get())'''
}
