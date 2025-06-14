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
        >
          <Abstract content="Why are investors overconfident and trade excessively? Why do patients at health risk avoid testing? Why are voters polarised? Possibly because their beliefs directly influence their well-being, i.e., they have belief-dependent preferences. However, existing theories of belief-dependent preferences struggle to generate testable predictions or to identify simultaneously beliefs and preferences. This paper addresses these issues by providing an axiomatic characterization of a class of preferences and belief-updating rules that deviate from Bayesian updating. Preferences, beliefs, and updating rules are identified from choices over contingent menus, each entailing a menu of acts available at a later time contingent on an uncertain state of the world. The results provide a theory-based approach to experimental designs to test information avoidance, distortion, and other behaviours consistent with belief-dependent preferences." />
        </CardExtended>
        <CardExtended
          title="A Foundation for Universalisation in Games"
          titleHref="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5284245"
        >
          <Abstract
            content="I study the behaviour of individuals who have preferences for universalisation. When considering a course of action, they evaluate the consequence that would occur if everyone else acted equivalently, according to some criterion of equivalence. That is, they universalise their behaviour. I develop and axiomatise a model for individuals who value their choices in light of the consequences they induce when their action is universalised. The key behavioural prediction is that the independence axiom is satisfied only among actions that are universalised equivalently. I impose conditions to single out the most prominent models of universalisation, compare them, highlight and arguably overcome their limitations. I propose a unifying model of universalisation inspired by the equal sacrifice principle."
            availability="New version coming soon!"
          />
        </CardExtended>
        <SectionTitle text="Work in Progress" />
        <CardExtended title="Meritocracy as an End and as a Means">
          <Abstract
            content="I introduce a framework for studying different interpretations of meritocracy and testing whether individuals adhere to them. Each meritocracy has two components: a merit criterion, determining when one individual is more meritorious than another, and a reward criterion for each individual, determining when one outcome is more rewarding than another for that individual. An allocation is meritocratic if more meritorious individuals are more rewarded. I distinguish between two conceptions of meritocracy. Meritocracy as an end holds it intrinsically valuable that individuals are rewarded according to their merit. Meritocracy as a means views rewarding merit as instrumental in achieving desirable outcomes according to other standards, such as efficiency. I show that these two conceptions are equivalent: each instance of meritocracy as a means can be associated with a corresponding meritocracy as an end. Finally, I examine two specific meritocracies present in the literature. Pareto meritocracy defines an action as more meritorious if it leads to a Pareto improvement in welfare, whereas proportional meritocracy requires that an individual’s consumption be proportional to the amount of labour he provides. By observing whether allocation choices of impartial spectators align with specific merit criteria, one can test whether spectators adhere to these meritocracies."
            availability="Draft coming soon, available upon request!"
          />
        </CardExtended>
        <CardExtended
          title="Prosocial Preferences, Beliefs, and Demand for Redistribution"
          authors="Michele Bisceglia"
          links="https://www.tse-fr.eu/fr/people/michele-bisceglia"
        >
          <Abstract
            content="We develop and test a theory of how beliefs about others' responsiveness to incentives shape preferences for redistribution. In an income taxation model with heterogeneous prosocial preferences, effort distortions from higher tax rates are less pronounced among more prosocial agents. Overly pessimistic beliefs about others' prosociality lead to a relatively low Condorcet-winner tax—even though most agents are poor and/or altruistic. Consistent with our theory, a laboratory experiment shows that informing subjects about others' prosocial preferences significantly increases the demand for redistribution."
            availability="We are processing the data of the experiment. Draft with theory and experimental design available upon request!"
            other="Pre-registration"
            linkother="https://osf.io/w3ep4"
          />
        </CardExtended>
        <CardExtended
          title="The Chaining Argument Unchained"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
        >
          <Abstract
            content="We argue that the chaining argument against the Trichotomy Thesis is on the horns of a dilemma. Either it is vacuous or it is unsound. Contrary to what it has been commonly assumed, it cannot be used as a reliable basis to adjudicate whether parity does or does not obtain. Stating the premises in a formal syntax that makes them consistent with each other deprives them of their intended meaning and makes the argument vacuous. The reason is that the argument, so stated, establishes a conclusion that is compatible with a variety of natural-language understandings of it that are unrelated to the initial intention of the argument or to the nature of value relations. If, instead, the premises of the argument are expressed in the weakest formal syntax to capture their meaning, the argument is unsound since its premises are inconsistent with each other. Besides demonstrating that the chaining argument does not provide insights into axiology, our result helps orient those interested in proving the existence of parity as a value relation towards alternative arguments."
            availability="Draft available upon request"
          />
        </CardExtended>
      </PageSection>
      <PageSection>
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
      {/*
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
