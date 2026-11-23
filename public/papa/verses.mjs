// Versi originali di opere in pubblico dominio. Ogni percorso punta
// alla specifica trascrizione di Wikisource usata per la scelta.
const poems = [
  ["Dante Alighieri", "Inferno, canto XXXIV", "Divina_Commedia/Inferno/Canto_XXXIV", [
    "E quindi uscimmo a riveder le stelle.",
    "intrammo a ritornar nel chiaro mondo;"
  ]],
  ["Giovanni Pascoli", "Mare", "Myricae/Dolcezze/Mare", [
    "M’affaccio alla finestra, e vedo il mare:",
    "vanno le stelle, tremolano l’onde.",
    "sul mare è apparso un bel ponte d’argento."
  ]],
  ["Giacomo Leopardi", "L’infinito", "Canti_(1835)/L%27infinito", [
    "Sempre caro mi fu quest’ermo colle,",
    "Silenzi, e profondissima quiete",
    "E il naufragar m’è dolce in questo mare."
  ]],
  ["Ada Negri", "Largo!", "Fatalit%C3%A0_(1895)/Largo!", [
    "Arte, per te combatto: — avvenire, t’attendo.",
    "Da l’acque azzurre dove il mite alcion sorvola,",
    "Sciolgo un peana al sol."
  ]],
  ["Francesco Petrarca", "Chiare, fresche et dolci acque", "Canzoniere_(Rerum_vulgarium_fragmenta)/Chiare,_fresche_et_dolci_acque", [
    "Chiare, fresche et dolci acque,",
    "una pioggia di fior’ sovra ’l suo grembo;",
    "girando parea dir: Qui regna Amore."
  ]],
  ["Giovanni Pascoli", "Alba", "Myricae/In_campagna/Alba", [
    "Odoravano i fior di vitalba",
    "guizzò un raggio, soffiò su gli ulivi;",
    "giorno: un giorno di pace e lavoro,"
  ]],
  ["Giosuè Carducci", "Traversando la maremma toscana", "Rime_nuove/Libro_II/Traversando_la_maremma_toscana", [
    "Pace dicono al cuor le tue colline",
    "Pur ti riveggo, e il cuor mi balza in tanto.",
    "Ridente ne le pioggie mattutine."
  ]],
  ["Gaspara Stampa", "Rime d’amore, I", "Rime_(Stampa)/Rime_d%27amore/I", [
    "Voi, ch’ascoltate in queste meste rime,",
    "spero trovar fra le ben nate genti,"
  ]],
  ["Giacomo Leopardi", "La quiete dopo la tempesta", "Canti_(1835)/La_quiete_dopo_la_tempesta", [
    "E chiaro nella valle il fiume appare.",
    "Ecco il Sol che ritorna, ecco sorride",
    "Si rallegra ogni core."
  ]],
  ["Ugo Foscolo", "A Zacinto", "A_Zacinto_(1835)", [
    "Zacinto mia, che te specchi nell’onde",
    "Le tue limpide nubi e le tue fronde"
  ]],
  ["Giovanni Pascoli", "Canzone d’aprile", "Myricae/In_campagna/Canzone_d%27aprile", [
    "la gioia vien teco:",
    "Tu giungi: sorrido;",
    "già t’odo cantare"
  ]],
  ["Dante Alighieri", "Paradiso, canto XXXIII", "Divina_Commedia/Paradiso/Canto_XXXIII", [
    "l’amor che move il sole e l’altre stelle."
  ]],
  ["Vittoria Colonna", "Stanze", "Rime_(Vittoria_Colonna)/Stanze", [
    "Cinta di bella e inestinguibil luce,",
    "Cantando or con le Ninfe, or co’ Pastori.",
    "Sentir col cor tranquillo, allegro, e puro"
  ]],
  ["Giovanni Pascoli", "L’assiuolo", "Myricae/In_campagna/L%27assiuolo", [
    "Le stelle lucevano rare",
    "sentivo il cullare del mare,",
    "notava in un’alba di perla,"
  ]],
  ["Giacomo Leopardi", "Il sabato del villaggio", "Canti_(1835)/Il_sabato_del_villaggio", [
    "Un mazzolin di rose e di viole,",
    "La donzelletta vien dalla campagna,",
    "Incontro là dove si perde il giorno;"
  ]],
  ["Francesco Petrarca", "Erano i capei d’oro a l’aura sparsi", "Canzoniere_(Rerum_vulgarium_fragmenta)/Erano_i_capei_d%27oro_a_l%27aura_sparsi", [
    "Erano i capei d’oro a l’aura sparsi",
    "uno spirto celeste, un vivo sole"
  ]],
  ["Giovanni Pascoli", "Dopo l’acquazzone", "Myricae/In_campagna/Dopo_l%27acquazzone", [
    "Un vel di pioggia vela l’orizzonte;",
    "placido olezza: va da monte a monte"
  ]],
  ["Ada Negri", "Fatalità", "Fatalit%C3%A0_(1895)/Fatalit%C3%A0", [
    "Voglio d’amor la trepida esultanza,",
    "Voglio il bacio del genio e della luce!..."
  ]],
  ["Dante Alighieri", "Purgatorio, canto I", "Divina_Commedia/Purgatorio/Canto_I", [
    "Per correr miglior acque alza le vele",
    "Dolce color d’orïental zaffiro,",
    "faceva tutto rider l’orïente,"
  ]],
  ["Giovanni Pascoli", "Arano", "Myricae/L%27ultima_passeggiata/Arano", [
    "sembra la nebbia mattinal fumare,",
    "il suo sottil tintinno come d’oro.",
    "e il pettirosso: nelle siepi s’ode"
  ]],
  ["Giacomo Leopardi", "La sera del dì di festa", "Canti_(1835)/La_sera_del_d%C3%AC_di_festa", [
    "Dolce e chiara è la notte e senza vento,",
    "Rara traluce la notturna lampa:",
    "Posa la luna, e di lontan rivela"
  ]],
  ["Giosuè Carducci", "San Martino", "Rime_nuove/Libro_III/San_Martino", [
    "La nebbia a gl’irti colli",
    "Urla e biancheggia il mar;",
    "Va l’aspro odor de i vini"
  ]],
  ["Giovanni Pascoli", "Novembre", "Myricae/In_campagna/Novembre", [
    "Gemmea l’aria, il sole così chiaro",
    "che tu ricerchi gli albicocchi in fiore,",
    "di nere trame segnano il sereno,"
  ]],
  ["Guido Guinizzelli", "Al cor gentil rempaira sempre amore", "Al_cor_gentil_rempaira_sempre_amore", [
    "Al cor gentil rempaira sempre amore",
    "Foco d’amore in gentil cor s’aprende"
  ]],
  ["Giacomo Leopardi", "A Silvia", "Canti_(1835)/A_Silvia", [
    "Mirava il ciel sereno,",
    "E quinci il mar da lungi, e quindi il monte.",
    "Era il maggio odoroso: e tu solevi"
  ]],
  ["Giovanni Pascoli", "Temporale", "Myricae/In_campagna/Temporale", [
    "Rosseggia l’orizzonte,",
    "tra il nero un casolare:",
    "un’ala di gabbiano."
  ]],
  ["Dante Alighieri", "Rime, LII", "Rime_(Dante)/LII_-_Guido,_i%27_vorrei_che_tu_e_Lapo_ed_io", [
    "di stare insieme crescesse ’l disio.",
    "e quivi ragionar sempre d’amore,"
  ]],
  ["Ugo Foscolo", "Alla Sera", "Alla_Sera_(1856)", [
    "Le nubi estive e i zefiri sereni,",
    "Vie del mio cor soavemente tieni."
  ]],
  ["Giovanni Pascoli", "Sera d’ottobre", "Myricae/In_campagna/Sera_d%27ottobre", [
    "ridere a mazzi le vermiglie bacche:",
    "nei campi intuona una fanciulla al vento:"
  ]],
  ["Giacomo Leopardi", "Alla luna", "Canti_(1835)/Alla_luna", [
    "O graziosa luna, io mi rammento",
    "E tu pendevi allor su quella selva",
    "Il sovvenir delle passate cose,"
  ]],
  ["Ada Negri", "Fra i boschi cedui", "Fatalit%C3%A0_(1895)/Fra_i_boschi_cedui", [
    "In alto, in alto sempre, in alto ancor!..."
  ]],
  ["Giovanni Pascoli", "Il fiume", "Myricae/Primavera/Il_fiume", [
    "a un po’ d’auretta scricchiola il canneto,",
    "sgorghi sonoro tra le brevi sponde;"
  ]],
  ["Dante Alighieri", "Purgatorio, canto XXXIII", "Divina_Commedia/Purgatorio/Canto_XXXIII", [
    "puro e disposto a salire a le stelle.",
    "rifatto sì come piante novelle"
  ]],
  ["Francesco Petrarca", "Solo et pensoso i piú deserti campi", "Canzoniere_(Rerum_vulgarium_fragmenta)/Solo_et_pensoso_i_pi%C3%BA_deserti_campi", [
    "Solo et pensoso i piú deserti campi",
    "vo mesurando a passi tardi et lenti,"
  ]],
  ["Giovanni Pascoli", "Lavandare", "Myricae/L%27ultima_passeggiata/Lavandare", [
    "Il vento soffia e nevica la frasca,",
    "con tonfi spessi e lunghe cantilene:"
  ]],
  ["Ludovico Ariosto", "Orlando furioso, canto I", "Orlando_furioso/Canto_1", [
    "Le donne, i cavallier, l’arme, gli amori,"
  ]]
];

// Presenta un verso per poesia prima di passare a un secondo verso della stessa opera.
const verses = [];
const mostLines = Math.max(...poems.map(([, , , lines]) => lines.length));
for (let index = 0; index < mostLines; index++) {
  for (const [author, title, path, lines] of poems) {
    if (lines[index]) {
      verses.push({ author, title, line: lines[index], url: `https://it.wikisource.org/wiki/${path}` });
    }
  }
}

export function verseForDate(date) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  return verses[((day % verses.length) + verses.length) % verses.length];
}
