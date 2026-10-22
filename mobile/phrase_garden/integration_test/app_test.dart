import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:phrase_garden/main.dart';
import 'package:phrase_garden/model.dart';

void main(){
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('iOS native launch, storage, flashcards and voice bridge',(tester)async{
    // Only this isolated simulator app's learning state is reset.
    final prefs=await SharedPreferences.getInstance();await prefs.remove('phrase-garden-native-v1');
    final s=await GardenStore.load();await tester.pumpWidget(GardenApp(s));await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('start-cards')));await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('flip')));await tester.tap(find.byKey(const Key('flip')));await tester.pumpAndSettle();
    expect(find.text("I'll follow up on your request tomorrow."),findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('remember')));await tester.tap(find.byKey(const Key('remember')));await tester.pumpAndSettle();
    expect(find.text('chase up'),findsOneWidget);
    final restored=await GardenStore.load();expect(restored.record(1).level,1);
    final tts=FlutterTts();final languages=await tts.getLanguages;expect(languages,isA<List>());
    await tts.setLanguage('en-GB');await tts.setSpeechRate(0.45);await tts.stop();
    // Native bridge checked; audible quality needs physical-device listening.
  });
}
