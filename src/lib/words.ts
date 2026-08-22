/** Curated answers for the word game. All common, all 5 letters.
 *  Guesses are validated for shape (5 letters) rather than against a full
 *  dictionary so the app stays tiny and fully offline. */
export const ANSWERS: readonly string[] = [
  "apple","brave","crane","dwell","eagle","flame","grape","house","ivory","jolly",
  "knack","lemon","mango","noble","ocean","piano","quilt","river","stone","tiger",
  "unity","vivid","whale","xenon","yacht","zebra","amber","bloom","charm","daisy",
  "ember","frost","glide","honey","islet","jewel","kneel","latch","medal","nerve",
  "olive","pearl","quart","roast","shine","trail","urban","vault","woven","axiom",
  "berry","cloud","dance","earth","fable","giant","heart","index","joint","koala",
  "light","mirth","north","orbit","plush","quest","raven","salsa","toast","under",
  "valor","wrist","young","zesty","angel","blaze","crisp","draft","elbow","forge",
  "gleam","hatch","inbox","jumbo","kayak","lunar","maple","ninja","onset","prism",
  "quick","ridge","spark","tempo","usher","vigor","wheat","yield","abide","bench",
  "cabin","depth","evoke","field","grasp","haste","irony","judge","knelt","ledge",
  "mount","nudge","opera","pivot","query","reign","scale","thorn","ultra","verse",
  "waltz","yeast","adobe","brisk","cider","dodge","essay","fjord","gecko","hover",
  "icing","jaunt","karma","llama","moose","nylon","otter","pluck","quota","rhyme",
  "swirl","truce","umbra","vinyl","wharf","yodel","attic","badge","chess","dozen",
  "elite","flint","gourd","husky","inlet","joker","kiosk","lasso","mocha","niche",
  "oasis","panda","quill","robin","siege","tulip","unzip","vouch","widow","xerox",
  "yummy","zonal","alarm","bison","comet","dwarf","exile","ferry","globe","harsh",
  "ideal","jelly","khaki","level","mimic","never","occur","pause","radar","seize",
  "trend","utter","venue","witty","alloy","brook","chalk","denim","erupt","fancy",
  "gauge","heron","input","jiffy","knoll","lyric","meaty","nomad","ounce","pesto",
  "quake","relay","stash","tweed","upset","vapor","wager","yearn","apron","batch",
  "clasp","dwelt","embed","flock","gravy","hinge","itchy","jetty","kudos","lodge",
  "melon","notch","opium","perch","quirk","rally","scarf","tonic","undue","vixen",
  "whisk","zippy","abate","broil","cocoa","decoy","eject","fudge","gusto","hydra",
  "igloo","jumpy","kebab","loyal","mural","navel","optic","pixel","razor","salon",
  "tiara","ulcer","valet","wedge","squad","amuse","blend","crown","dandy","evade",
  "flora","grill","haunt","image","joust","knead","lapel","month","nutty","oddly",
  "patio","quash","rebel","shrub","torch","untie","viola","waist","amble","adorn",
  "bluff","churn","ditto","eerie","flair","gnash","hoist","ionic","jazzy","kraut",
  "lofty","mercy","nifty","tripe","polka","queue","roost","sauna","thyme","unfit",
  "vocal","wound","abbey","binge","cameo","donor","enact","folly","grime","humid",
  "inept","juror","kitty","lilac","gloss","bacon","offer","plaza","quell","rusty",
  "scoop","tally","union","verge","woody","aloud","bugle","cynic","debut","envoy",
  "flute","genre","hurry","irate","cargo","dough","lager","motif","nurse","oaken",
  "prune","facet","rayon","slate","token","harpy","vying","wrath","yokel","azure",
  // Second tranche, shared with the mini crossword's clued list.
  "about","above","actor","adapt","admit","adore","after","again","agent","agree",
  "alert","alike","alive","allow","alone","along","angle","ankle","apart","arena",
  "arise","armor","aroma","asset","avoid","awake","award","baker","basic","basin",
  "beach","beard","began","begin","being","below","birth","black","blade","blame",
  "blank","block","board","brain","bread","break","brick","bride","brief","bring",
  "broad","broom","brown","brush","build","cable","camel","candy","canoe","carry",
  "catch","cause","chain","chair","chase","cheap","check","chest","chief","child",
  "chill","choir","civic","claim","class","clean","clear","clerk","cliff","climb",
  "clock","close","cloth","clown","coach","coast","color","coral","couch","count",
  "court","cover","crack","craft","crash","cream","crime","cross","crowd","curve",
  "cycle","daily","dairy","diary","dirty","drain","drama","dream","dress","drift",
  "drink","drive","early","eight","empty","enemy","enjoy","enter","equal","error",
  "event","every","exact","extra","faith","false","fever","fifty","final","first",
  "flash","fleet","float","floor","flour","fluid","focus","force","forty","found",
  "frame","fresh","front","fruit","glass","glory","glove","grace","grade","grain",
  "grand","grass","great","green","greet","group","guard","guess","guest","guide",
  "habit","happy","heavy","hello","hobby","horse","hotel","human","humor","inner",
  "issue","juice","knife","label","large","laser","laugh","layer","learn","limit",
  "local","logic","lucky","lunch","magic","major","march","match","metal","might",
  "minor","minus","model","money","moral","motor","mouse","mouth","movie","music",
  "night","noise","novel","often","onion","order","organ","other","outer","owner",
  "paint","panel","paper","party","peace","pedal","phone","photo","piece","pilot",
  "pizza","place","plain","plane","plant","plate","point","polar","porch","pound",
  "power","press","price","pride","prize","proof","proud","pupil","queen","quiet",
  "radio","raise","ranch","range","rapid","reach","ready","right","robot","rocky",
  "round","route","royal","rural","salad","scene","scent","score","sense","seven",
  "shade","shape","share","sharp","sheep","shelf","shell","shirt","shore","short",
  "shout","sight","silly","since","skill","sleep","slice","small","smart","smile",
  "smoke","snack","snake","solar","solid","solve","sound","south","space","spare",
  "speak","speed","spice","spoon","sport","stage","stair","stamp","stand","start",
  "state","steam","steel","stick","still","store","storm","story","stove","straw",
  "sugar","sunny","super","sweet","table","taste","teach","thank","theme","there",
  "thick","thing","think","third","three","throw","tight","title","today","tooth",
  "total","touch","tower","trace","track","trade","train","treat","trial","truck",
  "trunk","trust","truth","tutor","twice","uncle","upper","usual","value","video",
  "visit","vital","voice","wagon","waste","watch","water","weigh","wheel","where",
  "which","while","white","whole","woman","world","worth","write","wrong","youth"
];

export type LetterState = "correct" | "present" | "absent";

export function scoreGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(guess.length).fill("absent");
  const pool: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else pool[answer[i]] = (pool[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const c = guess[i];
    if (pool[c]) {
      result[i] = "present";
      pool[c]--;
    }
  }
  return result;
}
