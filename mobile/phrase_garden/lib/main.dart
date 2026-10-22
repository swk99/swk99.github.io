import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'model.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {runApp(GardenApp(await GardenStore.load()));}
  catch (_) {runApp(const MaterialApp(home:Scaffold(body:SafeArea(child:Center(child:Text('앱을 불러오지 못했어요. 다시 실행해 주세요.')))))) ;}
}
const green=Color(0xFF436447), cream=Color(0xFFF8F7EF);
class GardenApp extends StatelessWidget {
  final GardenStore store;
  const GardenApp(this.store,{super.key});
  @override Widget build(BuildContext context)=>MaterialApp(
    title:'Phrase Garden',debugShowCheckedModeBanner:false,
    theme:ThemeData(useMaterial3:true,colorScheme:ColorScheme.fromSeed(seedColor:green),
      scaffoldBackgroundColor:cream,appBarTheme:const AppBarTheme(backgroundColor:cream),
      cardTheme:const CardThemeData(elevation:0,color:Colors.white),
      filledButtonTheme:FilledButtonThemeData(style:FilledButton.styleFrom(padding:const EdgeInsets.symmetric(horizontal:20,vertical:16)))),
    home:GardenHome(store));
}
class GardenHome extends StatefulWidget {
  final GardenStore store;
  const GardenHome(this.store,{super.key});
  @override State<GardenHome> createState()=>_GardenHomeState();
}
class _GardenHomeState extends State<GardenHome> {
  int tab=0;
  String search='';
  int topic=0;
  bool stars=false;
  GardenStore get s=>widget.store;
  @override Widget build(BuildContext context)=>ListenableBuilder(listenable:s,builder:(context,_)=>Scaffold(
    appBar:AppBar(title:const Text('❧ phrase garden',style:TextStyle(fontWeight:FontWeight.w700,color:green)),actions:[IconButton(tooltip:'발음 설정',onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>SettingsPage(s))),icon:const Icon(Icons.tune))]),
    body:SafeArea(child:Column(children:[if(s.storageError!=null) MaterialBanner(content:Text(s.storageError!),actions:[TextButton(onPressed:(){},child:const Text('기록 저장 중단'))]),Expanded(child:IndexedStack(index:tab,children:[home(),library(),review()]))])),
    bottomNavigationBar:NavigationBar(selectedIndex:tab,onDestinationSelected:(i)=>setState(()=>tab=i),destinations:const[
      NavigationDestination(icon:Icon(Icons.wb_sunny_outlined),label:'오늘의 학습'),
      NavigationDestination(icon:Icon(Icons.menu_book),label:'표현 도서관'),
      NavigationDestination(icon:Icon(Icons.eco_outlined),label:'복습 정원')])));
  Widget panel(Widget child)=>Card(child:Padding(padding:const EdgeInsets.all(20),child:child));
  void study(List<Phrase> list,{String mode='card'}) {
    if(list.isEmpty)return;
    Navigator.push(context,MaterialPageRoute(builder:(_)=>StudyPage(s,list,mode)));
  }
  Widget home()=>ListView(padding:const EdgeInsets.all(20),children:[
    const Text('YOUR DAILY DOSE OF ENGLISH',style:TextStyle(letterSpacing:2,color:green,fontSize:11)),
    const SizedBox(height:14),const Text('하루 스무 개,\n영어가 자라는 시간.',style:TextStyle(fontSize:32,height:1.3,fontWeight:FontWeight.w800)),
    const SizedBox(height:12),const Text('듣고, 떠올리고, 나의 말로 차곡차곡.',style:TextStyle(color:Colors.black54)),const SizedBox(height:24),
    panel(Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      Row(children:[const Icon(Icons.spa,color:green),const SizedBox(width:8),Expanded(child:Text('${s.mastered} / 1,000개 익숙해졌어요'))]),
      const SizedBox(height:16),LinearProgressIndicator(value:s.mastered/1000,minHeight:7),
      const SizedBox(height:20),DropdownButtonFormField<int>(initialValue:s.day,decoration:const InputDecoration(labelText:'학습 일차',border:OutlineInputBorder()),items:List.generate(50,(i)=>DropdownMenuItem(value:i+1,child:Text('Day ${i+1} · 카드 20장'))),onChanged:(v){s.day=v!;s.save();}),
      const SizedBox(height:16),FilledButton.icon(key:const Key('start-cards'),onPressed:()=>study(s.today),icon:const Icon(Icons.style_outlined),label:const Text('오늘의 카드 시작')),
      const SizedBox(height:8),OutlinedButton.icon(onPressed:()=>study((s.today.toList()..shuffle()).take(10).toList(),mode:'quiz'),icon:const Icon(Icons.quiz_outlined),label:const Text('퀴즈 10문제')),
      OutlinedButton.icon(onPressed:()=>study((s.today.toList()..shuffle()).take(10).toList(),mode:'listen'),icon:const Icon(Icons.headphones),label:const Text('듣기 퀴즈'))])),
    const SizedBox(height:16),panel(Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('ONE SMALL STEP',style:TextStyle(color:green,letterSpacing:2,fontSize:11)),const SizedBox(height:12),Text(s.today.first.phrase,style:const TextStyle(fontSize:24,fontWeight:FontWeight.bold)),Text(s.today.first.meaning),const SizedBox(height:12),Text(s.today.first.example)])),
    const Padding(padding:EdgeInsets.all(12),child:Text('천천히, 하지만 꾸준히. 오늘의 한 문장도 충분해요.',textAlign:TextAlign.center))]);
  Widget library() {
    final list=s.phrases.where((p)=>(topic==0||p.topic==topic)&&(!stars||s.record(p.id).star)&&('${p.phrase} ${p.meaning} ${p.example}'.toLowerCase().contains(search.toLowerCase()))).toList();
    return Column(children:[Padding(padding:const EdgeInsets.fromLTRB(20,8,20,8),child:TextField(key:const Key('search'),decoration:const InputDecoration(hintText:'영어 표현 · 한글 뜻 검색',prefixIcon:Icon(Icons.search),border:OutlineInputBorder()),onChanged:(v)=>setState(()=>search=v))),
      Padding(padding:const EdgeInsets.symmetric(horizontal:20),child:Row(children:[Expanded(child:DropdownButton<int>(isExpanded:true,value:topic,items:[const DropdownMenuItem(value:0,child:Text('모든 주제')),for(final t in s.topics.entries)DropdownMenuItem(value:t.key,child:Text(t.value,overflow:TextOverflow.ellipsis))],onChanged:(v)=>setState(()=>topic=v!))),FilterChip(label:const Text('즐겨찾기'),selected:stars,onSelected:(v)=>setState(()=>stars=v))])),
      Padding(padding:const EdgeInsets.all(8),child:Text('${list.length}개 표현')),
      Expanded(child:list.isEmpty?const Center(child:Text('조건에 맞는 표현이 없어요.')):ListView.builder(itemCount:list.length,itemBuilder:(context,i)=>phraseTile(list[i])))]);
  }
  Widget phraseTile(Phrase p)=>Card(margin:const EdgeInsets.symmetric(horizontal:20,vertical:5),child:ListTile(contentPadding:const EdgeInsets.all(16),title:Text(p.phrase,style:const TextStyle(fontWeight:FontWeight.bold)),subtitle:Text('${p.meaning}\n${p.example}'),isThreeLine:true,onTap:()=>study([p]),trailing:IconButton(tooltip:'즐겨찾기',onPressed:()=>s.star(p.id),icon:Icon(s.record(p.id).star?Icons.star:Icons.star_border,color:green))));
  Widget review()=>ListView(padding:const EdgeInsets.all(20),children:[const Text('복습 정원',style:TextStyle(fontSize:30,fontWeight:FontWeight.bold)),const SizedBox(height:12),Text('지금 다시 만날 표현 ${s.review.length}개'),const SizedBox(height:16),FilledButton(onPressed:s.review.isEmpty?null:()=>study(s.review),child:const Text('복습 시작')),const SizedBox(height:12),const Text('기억한 표현은 1일 → 3일 → 7일 뒤 다시 만나요.\n틀린 표현은 바로 복습할 수 있어요.'),for(final p in s.review)phraseTile(p)]);
}
class StudyPage extends StatefulWidget {
  final GardenStore store;
  final List<Phrase> list;
  final String mode;
  const StudyPage(this.store,this.list,this.mode,{super.key});
  @override State<StudyPage> createState()=>_StudyPageState();
}
class _StudyPageState extends State<StudyPage> with WidgetsBindingObserver {
  final tts=FlutterTts();
  int index=0, correct=0;
  bool flipped=false,answered=false,busy=false,reverse=false;
  int? selected;
  late List<Phrase> options;
  Phrase get p=>widget.list[index];
  bool get quiz=>widget.mode!='card';
  @override void initState(){super.initState();WidgetsBinding.instance.addObserver(this);options=quizOptions(p,widget.store.phrases,Random());}
  @override void dispose(){WidgetsBinding.instance.removeObserver(this);tts.stop();super.dispose();}
  @override void didChangeAppLifecycleState(AppLifecycleState state){if(state!=AppLifecycleState.resumed)tts.stop();}
  void message(String text){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(text)));}
  Future<void> speak(String text,{bool slow=false}) async {
    try {
      await tts.stop();
      if(!kIsWeb&&defaultTargetPlatform==TargetPlatform.iOS){await tts.setSharedInstance(true);await tts.setIosAudioCategory(IosTextToSpeechAudioCategory.playback,[],IosTextToSpeechAudioMode.defaultMode);}
      final available=await tts.isLanguageAvailable(widget.store.locale);
      if(available!=true&&available!=1){message('이 기기에 해당 영어 음성이 없어요. 음성 설정을 확인해 주세요.');return;}
      await tts.setLanguage(widget.store.locale);await tts.setSpeechRate(slow?0.3:widget.store.rate);
      final result=await tts.speak(text);
      if(result==0)message('발음을 재생하지 못했어요. 음성 설정을 확인해 주세요.');
    }catch(_){message('발음 재생에 실패했어요. 기기의 영어 음성을 확인해 주세요.');}
  }
  Future<void> dictionary() async {
    await tts.stop();
    try {if(!await launchUrl(p.dictionary,mode:LaunchMode.externalApplication))message('사전을 열지 못했어요. 인터넷 연결을 확인해 주세요.');}
    catch(_){message('사전을 열지 못했어요. 인터넷 연결을 확인해 주세요.');}
  }
  Future<void> grade(bool good,{int? id}) async {
    if(busy||answered)return;
    setState(()=>busy=true);
    await widget.store.mark(p.id,good);
    if(!mounted)return;
    if(good)correct++;
    if(quiz){setState((){answered=true;selected=id;busy=false;});}
    else {next();}
  }
  void next(){tts.stop();setState((){index++;flipped=false;answered=false;selected=null;busy=false;if(index<widget.list.length)options=quizOptions(p,widget.store.phrases,Random());});}
  @override Widget build(BuildContext context){
    if(index>=widget.list.length)return Scaffold(appBar:AppBar(title:const Text('오늘도 한 걸음')),body:SafeArea(child:Center(child:Padding(padding:const EdgeInsets.all(24),child:Column(mainAxisSize:MainAxisSize.min,children:[const Icon(Icons.spa,size:80,color:green),const SizedBox(height:20),const Text('학습을 마쳤어요!',style:TextStyle(fontSize:28,fontWeight:FontWeight.bold)),Text('$correct / ${widget.list.length}개 ${quiz?'정답':'기억했어요'}'),const SizedBox(height:24),FilledButton(onPressed:()=>Navigator.pop(context),child:const Text('정원으로 돌아가기'))])))));
    final hidden=widget.mode=='listen'&&!answered;
    return Scaffold(appBar:AppBar(title:Text(quiz?'${widget.mode=='listen'?'듣기':'표현'} 퀴즈':'플래시카드')),body:SafeArea(child:ListView(padding:const EdgeInsets.all(20),children:[
      Text('${index+1} / ${widget.list.length} · ${widget.store.topics[p.topic]}'),const SizedBox(height:12),LinearProgressIndicator(value:index/widget.list.length),const SizedBox(height:20),
      Card(child:Padding(padding:const EdgeInsets.all(24),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[Text('NO. ${p.id.toString().padLeft(4,'0')}',style:const TextStyle(color:green)),IconButton(tooltip:'즐겨찾기',onPressed:() async {await widget.store.star(p.id);if(mounted)setState((){});},icon:Icon(widget.store.record(p.id).star?Icons.star:Icons.star_border))]),
        const SizedBox(height:20),Text(hidden?'귀를 기울여 볼까요?':reverse?p.meaning:p.phrase,key:const Key('card-prompt'),textAlign:TextAlign.center,style:const TextStyle(fontSize:30,fontWeight:FontWeight.bold)),
        if(flipped||answered)...[const SizedBox(height:18),Text(reverse?p.phrase:p.meaning,textAlign:TextAlign.center,style:const TextStyle(fontSize:20,color:green)),const SizedBox(height:16),Text(p.example,textAlign:TextAlign.center,style:const TextStyle(fontSize:17,height:1.5))],
        const SizedBox(height:24),Wrap(alignment:WrapAlignment.center,spacing:8,runSpacing:8,children:[OutlinedButton.icon(onPressed:()=>speak(p.phrase),icon:const Icon(Icons.volume_up),label:Text(hidden?'문제 듣기':'표현 듣기')),OutlinedButton(onPressed:()=>speak(p.phrase,slow:true),child:const Text('느리게')),if(flipped||answered)OutlinedButton(onPressed:()=>speak(p.example),child:const Text('예문 듣기'))]),
        if(!hidden)...[TextButton(onPressed:dictionary,child:const Text('Cambridge 사전 ↗')),const Text('공식 사전의 UK / US 녹음 확인 · 인터넷 필요',textAlign:TextAlign.center,style:TextStyle(fontSize:11,color:Colors.black54))],
        if(!quiz)OutlinedButton(key:const Key('flip'),onPressed:()=>setState(()=>flipped=!flipped),child:Text(flipped?'앞면 보기':'뜻 확인하기'))]))),
      const SizedBox(height:12),
      if(!quiz)...[FilledButton(key:const Key('remember'),onPressed:flipped&&!busy?()=>grade(true):null,child:const Text('기억했어요')),const SizedBox(height:8),OutlinedButton(onPressed:flipped&&!busy?()=>grade(false):null,child:const Text('다시 볼게요')),TextButton(onPressed:()=>setState((){reverse=!reverse;flipped=false;}),child:Text(reverse?'영어 먼저 보기':'한글 먼저 보기'))]
      else ...[for(final o in options)Padding(padding:const EdgeInsets.only(bottom:8),child:OutlinedButton(style:OutlinedButton.styleFrom(backgroundColor:answered&&o.id==p.id?const Color(0xFFDCEBD9):answered&&o.id==selected?const Color(0xFFFFDDDD):null),onPressed:answered||busy?null:()=>grade(o.id==p.id,id:o.id),child:Text('${o.meaning}${answered&&o.id==p.id?' ✓':''}'))),if(answered)...[Text(selected==p.id?'맞았어요!':'괜찮아요. 복습 정원에 저장했어요.',textAlign:TextAlign.center),FilledButton(onPressed:next,child:const Text('다음'))]],
      const SizedBox(height:16),const Text('앱 내 발음은 기기의 음성 합성이에요.',textAlign:TextAlign.center,style:TextStyle(color:Colors.black54,fontSize:12))])));
  }
}
class SettingsPage extends StatefulWidget {
  final GardenStore s;
  const SettingsPage(this.s,{super.key});
  @override State<SettingsPage> createState()=>_SettingsPageState();
}
class _SettingsPageState extends State<SettingsPage> {
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('발음 설정')),body:SafeArea(child:ListView(padding:const EdgeInsets.all(24),children:[
    const Text('내 귀에 익숙한 영어',style:TextStyle(fontSize:26,fontWeight:FontWeight.bold)),const SizedBox(height:24),
    DropdownButtonFormField<String>(initialValue:widget.s.locale,decoration:const InputDecoration(labelText:'발음'),items:const[DropdownMenuItem(value:'en-GB',child:Text('영국 영어')),DropdownMenuItem(value:'en-US',child:Text('미국 영어'))],onChanged:(v){setState(()=>widget.s.locale=v!);widget.s.save();}),
    const SizedBox(height:24),const Text('읽기 속도'),Slider(value:widget.s.rate,min:0.2,max:0.6,divisions:8,label:widget.s.rate.toStringAsFixed(2),onChanged:(v){setState(()=>widget.s.rate=v);},onChangeEnd:(_)=>widget.s.save()),
    const SizedBox(height:24),const Text('카드와 퀴즈는 오프라인으로 사용할 수 있어요. 발음은 설치된 기기 음성에 따라 달라요. Cambridge 버튼은 공식 사전을 인터넷으로 엽니다.\n\n학습 기록은 이 앱에 저장돼요. 웹사이트 기록과 자동으로 동기화되지 않아요. 앱을 삭제하면 기록이 지워질 수 있어요.',style:TextStyle(height:1.7))])));
}
