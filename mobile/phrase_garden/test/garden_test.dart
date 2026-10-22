import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:phrase_garden/model.dart';
import 'package:phrase_garden/main.dart';

void main(){
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp((){SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('flutter_tts'), (_) async => 1);
  });
  test('1000 complete records, 50 days and unambiguous quizzes',() async {
    final s=await GardenStore.load();
    expect(s.phrases.length,1000);expect(s.phrases.map((p)=>p.id).toSet().length,1000);
    for(var day=1;day<=50;day++){expect(s.phrases.where((p)=>p.day==day).length,20);}
    for(final p in s.phrases){expect(p.example,isNotEmpty);expect(p.meaning,isNotEmpty);final o=quizOptions(p,s.phrases,Random(p.id));expect(o.length,4);expect(o.map((p)=>p.meaning).toSet().length,4);expect(o.where((x)=>x.id==p.id).length,1);expect(p.dictionary.queryParameters['q'],p.phrase);}
  });
  test('Review intervals reset on wrong answer',(){
    final p=Progress();final now=DateTime(2026,10,22);
    for(final days in [1,3,7,7]){p.mark(true,now);expect(p.due,now.add(Duration(days:days)));}
    p.mark(false,now);expect(p.level,0);expect(p.wrong,true);expect(p.due,now);
  });
  test('Progress, favourites and voice persist after reload',()async{
    final s=await GardenStore.load();await s.mark(1,true);await s.star(2);s.day=17;s.locale='en-US';await s.save();
    final again=await GardenStore.load();expect(again.record(1).level,1);expect(again.record(2).star,true);expect(again.day,17);expect(again.locale,'en-US');
  });
  for(final width in [320.0,390.0]){
    testWidgets('Small screen $width flip, grade and search',(tester)async{
      tester.view.physicalSize=Size(width,844);tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
      final s=await GardenStore.load();await tester.pumpWidget(GardenApp(s));await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('start-cards')));await tester.pumpAndSettle();
      expect(find.text('follow up on'),findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const Key('remember'))).onPressed,isNull);
      await tester.ensureVisible(find.byKey(const Key('flip')));await tester.tap(find.byKey(const Key('flip')));await tester.pumpAndSettle();
      expect(find.text("I'll follow up on your request tomorrow."),findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('remember')));await tester.tap(find.byKey(const Key('remember')));await tester.pumpAndSettle();
      expect(find.text('chase up'),findsOneWidget);expect(s.record(1).seen,1);
      await tester.pageBack();await tester.pumpAndSettle();await tester.tap(find.text('표현 도서관'));await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('search')),'fob off');await tester.pumpAndSettle();expect(find.text('fob off'),findsOneWidget);expect(tester.takeException(),isNull);
    });
  }
}
