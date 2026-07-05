import { COLORS, SERIF, MONO } from "@/lib/tokens";

/**
 * UNLINKED page: nothing on the site links here (no nav item, no footer link).
 * Reachable only by typing /quotes. Keep adding entries to `quotes` below.
 */

interface Quote {
  text: string;
  source: React.ReactNode; // may include <em> for the italicised work title
  comment: string;
  preLine?: boolean; // preserve line breaks (song lyrics)
}

const quotes: Quote[] = [
  {
    text: `To change the world
It starts with one step
However small
First step is hardest of all
Once you get to your gate
You will walk in tall
You said you never did
'Cause you might die trying`,
    source: (
      <>
        Dave Matthews Band (2005). <span style={{ fontStyle: "normal" }}>You Might Die Trying.</span>
      </>
    ),
    comment: "How I feel when I start writing a paper from scratch.",
    preLine: true,
  },
  {
    text: "If the model under consideration is a formal model, that is, if it does not pretend to model reality adequately, then the model assumptions are in a sense arbitrary, that is, the model builder can freely decide which model characteristics he chooses. If, however, the model or theory asserts factuality, that is, if conclusions drawn from these models have a bearing on reality and are supposed to model reality adequately, then the modeling language has to be suited to model the characteristics of the situation under study appropriately.",
    source: (
      <>
        Zimmermann, H. J. (2011). <span style={{ fontStyle: "normal" }}>Fuzzy set theory—and its applications.</span>{" "}
        Springer Science &amp; Business Media. (p. 2)
      </>
    ),
    comment:
      'The entire introduction of this book is worth reading even if you are not interested in the topic. It is a brilliant discussion of the relationship between natural language and mathematics. I think this passage suggests a distinction between two aims of modeling: obtaining a "logical" result or describing an empirical counterpart. (Is the first even "modeling"?)',
  },
  {
    text: "Funny rationality, what would positions in power be? Led by feelings that seemingly change hourly.",
    source: (
      <>
        Paris Paloma (2023). <span style={{ fontStyle: "normal" }}>Drywall.</span>
      </>
    ),
    comment: "Nice quote for a paper arguing that dynamic consistency is necessary for rationality (I doubt it is).",
  },
  {
    text: "Allegiance to rigor dictates the axiomatic form of the analysis where the theory, in the strict sense, is logically entirely disconnected from its interpretations. In order to bring out fully this disconnectedness, all the definitions, all the hypotheses, and the main results of the theory, in the strict sense, are distinguished by italics… Such a dichotomy reveals all the assumptions and the logical structure of the analysis. It also makes possible immediate extensions of that analysis without modification of the theory, by simple reinterpretations of concepts.",
    source: (
      <>
        Debreu, G. (1959).{" "}
        <span style={{ fontStyle: "normal" }}>Theory of value: An axiomatic analysis of economic equilibrium</span>{" "}
        (Vol. 17). Yale University Press. (p. x)
      </>
    ),
    comment:
      "I wish it were common to explicitly distinguish the logical results of a paper from their interpretation. I feel that by collapsing these two we step into a strange ontological paradox in which the empirical counterpart is the artificial construct of the theory.",
  },
  {
    text: "It is our choices, Harry, that show what we truly are, far more than our abilities.",
    source: (
      <>
        Rowling, J. K. (2016).{" "}
        <span style={{ fontStyle: "normal" }}>Harry Potter and the Chamber of Secrets</span> (Vol. 2). Bloomsbury
        Publishing.
      </>
    ),
    comment: "Albus Dumbledore adheres to revealed preference theory.",
  },
  {
    text: 'For instance, there is no need to argue whether economics (or decision theory, or sociology) is a science. We may define "science" in a way that includes economics or in a way that doesn\'t, depending on which generalizations will be easier to state using the definition.',
    source: (
      <>
        Gilboa, I. (2009). <span style={{ fontStyle: "normal" }}>Theory of decision under uncertainty</span> (Vol. 45).
        Cambridge University Press. (p. 58)
      </>
    ),
    comment:
      'I asked myself and discussed with others about this point multiple times. But in the end, I stopped caring. Is it about the accuracy of predictions? Then just set the bar you like for accepting a discipline as a science. Is it about math? Economists use math, and their results are no different than those in mathematics or other "sciences."',
  },
];

export default function Quotes() {
  return (
    <main className="site-main">
      <h1
        style={{
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.accent,
          fontWeight: 500,
        }}
      >
        Quotes
      </h1>
      <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.72, color: "#3a4650", marginTop: 16, maxWidth: 620 }}>
        I sometimes find nice quotes on random topics from books, songs or other media. I collect these here, in no
        particular order, with or without commentary. Reach out if you want to discuss any of them!
      </p>

      {quotes.map((q, i) => (
        <figure
          key={i}
          style={{ margin: 0, padding: "38px 0", borderBottom: i < quotes.length - 1 ? `1px solid ${COLORS.hairline}` : "none" }}
        >
          <blockquote
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 20,
              lineHeight: 1.6,
              color: COLORS.ink,
              fontStyle: "italic",
              borderLeft: `2px solid ${COLORS.linkUnderline}`,
              paddingLeft: 24,
              whiteSpace: q.preLine ? "pre-line" : "normal",
            }}
          >
            {q.text}
          </blockquote>
          <figcaption
            style={{ fontFamily: MONO, fontSize: 12, color: COLORS.faint, marginTop: 16, paddingLeft: 26 }}
          >
            {q.source}
          </figcaption>
          <p
            style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.7, color: "#5b6670", marginTop: 14, paddingLeft: 26, maxWidth: 600 }}
          >
            {q.comment}
          </p>
        </figure>
      ))}
    </main>
  );
}
