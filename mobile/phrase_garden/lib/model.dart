import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Phrase {
  final int id, day, topic;
  final String phrase, meaning, example;
  Phrase(Map<String, dynamic> j)
      : id = j['id'], day = j['day'], topic = j['topic'],
        phrase = j['phrase'], meaning = j['meaning'], example = j['example'];
  Uri get dictionary => Uri.https('dictionary.cambridge.org', '/search/direct/',
      {'datasetsearch': 'english', 'q': phrase});
}
class Progress {
  int level, seen;
  bool star, wrong;
  DateTime? due;
  Progress({this.level=0, this.seen=0, this.star=false, this.wrong=false, this.due});
  factory Progress.fromJson(Map<String,dynamic> j) => Progress(
    level: j['level'] ?? 0, seen: j['seen'] ?? 0, star: j['star'] ?? false,
    wrong: j['wrong'] ?? false, due: DateTime.tryParse(j['due'] ?? ''));
  Map<String,dynamic> toJson() => {'level':level,'seen':seen,'star':star,'wrong':wrong,'due':due?.toIso8601String()};
  void mark(bool good, DateTime now) {
    seen++;
    if(good) {level=min(3,level+1); wrong=false; due=now.add(Duration(days:[1,3,7][level-1]));}
    else {level=0; wrong=true; due=now;}
  }
}
class GardenStore extends ChangeNotifier {
  final List<Phrase> phrases;
  final Map<int,String> topics;
  final SharedPreferences prefs;
  final Map<int,Progress> records={};
  int day=1;
  String locale='en-GB';
  double rate=0.45;
  String? storageError;
  GardenStore(this.phrases,this.topics,this.prefs) {
    final raw=prefs.getString('phrase-garden-native-v1');
    if(raw!=null) {
      try {
        final j=jsonDecode(raw) as Map<String,dynamic>;
        day=(j['day'] as int? ?? 1).clamp(1,50);
        locale=j['locale']=='en-US'?'en-US':'en-GB';
        rate=(j['rate'] as num? ?? 0.45).toDouble().clamp(0.2,0.6);
        (j['records'] as Map<String,dynamic>).forEach((key,value) {
          final id=int.tryParse(key);
          if(id!=null && phrases.any((p)=>p.id==id)) records[id]=Progress.fromJson(value);
        });
      } catch (_) {storageError='저장된 기록을 읽지 못했어요. 앱을 닫고 다시 확인해 주세요.';}
    }
  }
  static Future<GardenStore> load() async {
    final j=jsonDecode(await rootBundle.loadString('assets/phrases.json'));
    return GardenStore((j['phrases'] as List).map((x)=>Phrase(x)).toList(),
      {for(final t in j['topics']) t['id'] as int:t['name'] as String},await SharedPreferences.getInstance());
  }
  Progress record(int id)=>records.putIfAbsent(id,()=>Progress());
  List<Phrase> get today=>phrases.where((p)=>p.day==day).toList();
  List<Phrase> get review=>phrases.where((p){final r=record(p.id);return r.due!=null&&!r.due!.isAfter(DateTime.now());}).toList();
  int get mastered=>records.values.where((r)=>r.level>=3).length;
  Future<void> save() async {
    if(storageError!=null) {notifyListeners();return;}
    try {
      final ok=await prefs.setString('phrase-garden-native-v1',jsonEncode({
        'day':day,'locale':locale,'rate':rate,
        'records':records.map((k,v)=>MapEntry('$k',v.toJson()))}));
      if(!ok) throw StateError('Save failed');
    } catch (_) {storageError='기록 저장에 실패했어요. 저장 공간을 확인해 주세요.';}
    notifyListeners();
  }
  Future<void> mark(int id,bool good) async {record(id).mark(good,DateTime.now());await save();}
  Future<void> star(int id) async {record(id).star=!record(id).star;await save();}
}
List<Phrase> quizOptions(Phrase correct,List<Phrase> all,Random random) {
  final meanings=<String>{correct.meaning};
  final candidates=all.where((p)=>p.id!=correct.id).toList()..shuffle(random);
  final options=<Phrase>[correct];
  for(final p in candidates) {if(meanings.add(p.meaning)) options.add(p);if(options.length==4)break;}
  return options..shuffle(random);
}
