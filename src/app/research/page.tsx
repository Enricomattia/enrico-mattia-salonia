import PageSection from "@/components/atoms/PageSection/PageSection";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";
import CardExtended from "@/components/organisms/CardExtended/CardExtended";
import Abstract from "@/components/atoms/Abstract/Abstract";
import CardTitle from "@/components/atoms/CardTitle/CardTitle";
import TextSimple from "@/components/atoms/TextSimple/TextSimple";
import Link from "@/components/atoms/Link/Link";

export default function Research() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Working Papers" />
        <CardExtended
          title="Identifying Belief-dependent Preferences"
          titleHref="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5273829"
          status=""
          imageSrc="/img/eq_bdp.png"
        >
          <Abstract content="Belief-dependent preferences — where an individual's well-being depends directly on her beliefs — have been proposed to explain phenomena such as information avoidance, overconfidence, and polarisation. However, existing theories of belief-dependent preferences struggle to generate testable predictions or to simultaneously identify beliefs and preferences. This paper addresses these issues by providing an axiomatic characterisation of a class of preferences and belief-updating rules that deviate from Bayesian updating. Preferences, beliefs, and updating rules are identified from choices over contingent menus, each comprising a menu of acts available at a later time contingent on an uncertain state of the world. The results provide a theory-based approach to experimental designs for testing information avoidance, distortion, and other behaviours consistent with belief-dependent preferences." />
        </CardExtended>
        <CardExtended
          title="A Foundation for Universalisation in Games"
          titleHref="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5284245"
          status="Old draft, new version coming soon!"
          imageSrc="/img/eq_up.png"
        >
          <Abstract
            content="I study the behaviour of individuals who have preferences for universalisation. When considering a course of action, they evaluate the consequence that would occur if everyone else acted equivalently, according to some criterion of equivalence. That is, they universalise their behaviour. I develop and axiomatise a model for individuals who value their choices in light of the consequences they induce when their action is universalised. The key behavioural prediction is that the independence axiom is satisfied only among actions that are universalised equivalently. I impose conditions to single out the most prominent models of universalisation, compare them, highlight and arguably overcome their limitations. I propose a unifying model of universalisation inspired by the equal sacrifice principle."
          />
        </CardExtended>
        <CardExtended 
        title="Meritocracy as an End and as a Means"
        titleHref="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5281750"
        status="Very preliminary draft, new version coming soon!"
        imageSrc="/img/eq_mer.png"
        >
          <Abstract
            content="I introduce a framework for studying different interpretations of meritocracy. Each meritocracy has two components: a merit criterion, which determines when one individual is more meritorious than another, and a reward criterion, which determines when one outcome is more rewarding for a given individual. An allocation is meritocratic if more meritorious individuals are more highly rewarded. The framework distinguishes between meritocracy as an end, in which rewarding meritorious preferences is intrinsically valuable, and meritocracy as a means, in which rewarding meritorious actions is instrumentally valuable for achieving desirable outcomes. I show that these two conceptions are equivalent: any merit criterion over actions in a mechanism that yields meritorious outcomes must reduce to an underlying merit criterion over preferences. I apply the framework to two specific conceptions of meritocracy. Pareto meritocracy, according to which an action is more meritorious if it leads to a Pareto improvement, turns out to be vacuous, imposing virtually no constraints on allocations. Proportional meritocracy, according to which each individual’s consumption is proportional to labour input, is characterised by three conditions: monotonicity of the merit criterion in labour, scale invariance, and a welfarist reward criterion. This characterisation yields testable predictions for experiments where impartial spectators choose allocations."
          />
        </CardExtended>
        <CardExtended
          title="The Chaining Argument Unchained"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
          status="Submitted, draft available upon request"
          imageSrc="/img/eq_chang.png"
        >
          <Abstract
            content="We argue that the chaining argument against the Trichotomy Thesis is on the horns of a dilemma. Either it is vacuous or it is unsound. Contrary to what it has been commonly assumed, it cannot be used as a reliable basis to adjudicate whether parity does or does not obtain. Stating the premises in a formal syntax that makes them consistent with each other deprives them of their intended meaning and makes the argument vacuous. The reason is that the argument, so stated, establishes a conclusion that is compatible with a variety of natural-language understandings of it that are unrelated to the initial intention of the argument or to the nature of value relations. If, instead, the premises of the argument are expressed in the weakest formal syntax to capture their meaning, the argument is unsound since its premises are inconsistent with each other. Besides demonstrating that the chaining argument does not provide insights into axiology, our result helps orient those interested in proving the existence of parity as a value relation towards alternative arguments."
          />
        </CardExtended>
        <CardExtended
          title="A Theory of Acting against the Odds"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
          status="Submitted, draft available upon request."
          imageSrc="/img/eq_ato.png"
        >
          <Abstract
            content="Acting against the odds has been understood as acting despite evidence that one is unlikely to succeed. The existing literature reduces the rationality of this behaviour to the rationality of believing against the odds. We argue that the current definition of this behaviour is insufficiently precise and show that reducing the rationality of acting against the odds to the rationality of believing against the odds is neither necessary nor sufficient to explain the phenomenon. We develop a decision-theoretic framework separating tastes over outcomes, beliefs over uncertain states, and a taste for agency — the value of increasing one's likelihood of success through one's own choice relative to other available actions. The theory is built around what is philosophically interesting about acting against the odds: its agential character. We show that the taste for agency violates the independence axiom and is inconsistent with expected utility, rank-dependent utility, or other theories evaluating risky prospects in isolation. Because the taste for agency is independent of belief formation and updating, an individual who acts against the odds need not be an unconventional reasoner — she may be Bayesian. Our theory also sheds light on two adjacent debates: deliberation versus self-prediction and resoluteness versus sophistication."
          />
        </CardExtended>
        <SectionTitle text="Work in Progress" />
        <CardExtended
          title="Prosocial Preferences, Beliefs, and Demand for Redistribution"
          authors="Michele Bisceglia"
          links="https://sites.google.com/view/michele-bisceglia/home-page"
          status="We are processing the data of the experiment. Draft with theory and experimental design available upon request!"
          imageSrc="/img/eq_red.png"
        >
          <Abstract
            content="We develop and test a theory of how beliefs about others' responsiveness to incentives shape preferences for redistribution. In an income taxation model with heterogeneous prosocial preferences, effort distortions from higher tax rates are less pronounced among more prosocial individuals. As a result, overly pessimistic beliefs about others' prosociality can lead to a relatively low Condorcet-winner tax, even though most individuals are poor or altruistic. However, a laboratory experiment shows that providing information about others' prosocial preferences does not increase demand for redistribution among pessimistic subjects, suggesting that selfish individuals form pessimistic self-serving beliefs to justify their policy preferences."
            other="Pre-registration"
            linkother="https://osf.io/w3ep4"
          />
        </CardExtended>
      </PageSection>
  {/*    <PageSection>
        <SectionTitle text="Book Review" />
        <CardExtended
          title="Review of Ivan Moscati’s Measuring Utility: From the Marginal Revolution to Behavioral Economics"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
        >
          <Link
            text="Link"
            href="https://ejpe.org/journal/article/view/469/337"
            size="text-m"
          />
        </CardExtended>
      </PageSection>
      <PageSection>
        <SectionTitle text="Other Work" />
        <TextSimple content="I have some work in areas in the neighbourhood of economics, but not quite there. You can find it here." />
        <CardExtended
          title="[Title redacted]"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
        >
          <Abstract
            content="This paper aims to show that the chaining argument offered by Ruth Chang to support the existence of parity is of no help in adjudicating the truth or falsity of the Trichotomy Thesis."
            availability="Draft available upon request"
          />
        </CardExtended>
      </PageSection>
       */}
    </main>
  );
}
