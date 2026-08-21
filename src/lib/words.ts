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
  "prune","facet","rayon","slate","token","harpy","vying","wrath","yokel","azure"
];

/** Extra common 5-letter words accepted as guesses (never answers).
 *  Kept deliberately small to stay offline-tiny — extend freely. */
const GUESS_EXTRA: readonly string[] = [
  "about","above","abuse","actor","acute","admit","adopt","adult","after","again",
  "agent","agree","ahead","alert","alike","alive","allow","alone","along","alter",
  "among","anger","angle","angry","apart","arena","argue","arise","armor","array",
  "aside","asset","audio","audit","avoid","awake","award","aware","badly","baker",
  "bases","basic","basis","beach","began","begin","begun","being","below","black",
  "blame","blind","block","blood","board","boost","booth","bound","brain","brand",
  "bread","break","breed","brief","bring","broad","broke","brown","build","built",
  "buyer","cable","calif","carry","catch","cause","chain","chair","chart","chase",
  "cheap","check","chest","chief","child","china","chose","civil","claim","class",
  "clean","clear","click","climb","clock","close","coach","coast","could","count",
  "court","cover","craft","crash","cream","crime","cross","crowd","crude","curve",
  "cycle","daily","dated","dealt","death","delay","depot","doing","doubt","dozen",
  "drama","drawn","dream","dress","drill","drink","drive","drove","dying","eager",
  "early","eight","empty","enemy","enjoy","enter","entry","equal","error","event",
  "every","exact","exist","extra","faith","false","fault","fiber","fifth","fifty",
  "fight","final","first","fixed","flash","fleet","floor","fluid","focus","force",
  "forth","forty","forum","found","frame","frank","fraud","fresh","front","fruit",
  "fully","funny","given","glass","going","grace","grade","grand","grant","grass",
  "great","green","gross","group","grown","guard","guess","guest","guide","happy",
  "harry","heavy","hence","henry","horse","hotel","human","ideal","imply","inner",
  "issue","japan","jimmy","joint","jones","known","label","large","laser","later",
  "laugh","layer","learn","lease","least","leave","legal","lewis","limit","links",
  "lives","local","logic","loose","lower","lucky","lunch","lying","magic","major",
  "maker","march","maria","match","maybe","mayor","meant","media","metal","might",
  "minor","minus","mixed","model","money","moral","motor","mouse","mouth","movie",
  "music","needs","newly","night","noise","novel","occur","offer","often","order",
  "other","ought","paint","panel","paper","party","peace","peter","phase","phone",
  "photo","piece","pilot","pitch","place","plain","plane","plant","plate","point",
  "pound","power","press","price","pride","prime","print","prior","prize","proof",
  "proud","prove","queen","quiet","quite","radio","raise","range","rapid","ratio",
  "reach","ready","refer","right","rival","robot","roger","roman","rough","round",
  "route","royal","rural","scene","scope","score","sense","serve","seven","shall",
  "shape","share","sharp","sheet","shelf","shell","shift","shirt","shock","shoot",
  "short","shown","sight","since","sixth","sixty","sized","skill","sleep","slide",
  "small","smart","smile","smith","smoke","solid","solve","sorry","sound","south",
  "space","spare","speak","speed","spend","spent","split","spoke","sport","staff",
  "stage","stake","stand","start","state","steam","steel","stick","still","stock",
  "store","storm","story","strip","stuck","study","stuff","style","sugar","suite",
  "super","sweet","table","taken","taste","taxes","teach","teeth","terry","texas",
  "thank","theft","their","theme","there","these","thick","thing","think","third",
  "those","three","threw","throw","tight","times","tired","title","today","topic",
  "total","touch","tough","tower","track","trade","train","treat","trial","tried",
  "tries","truck","truly","trust","truth","twice","uncle","undue","union","unity",
  "until","upper","urged","usage","usual","valid","value","video","virus","visit",
  "vital","voice","waste","watch","water","wheel","where","which","while","white",
  "whole","whose","woman","women","world","worry","worse","worst","worth","would",
  "write","wrong","wrote","yield","yours","youth"
];

const VALID_GUESSES = new Set([...ANSWERS, ...GUESS_EXTRA]);

/** Is this 5-letter string an accepted guess word? */
export function isValidGuess(word: string): boolean {
  return VALID_GUESSES.has(word.toLowerCase());
}

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
