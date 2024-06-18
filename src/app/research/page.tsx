import PageSection from "@/components/atoms/PageSection/PageSection";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";
import CardExtended from "@/components/organisms/CardExtended/CardExtended";
import Abstract from "@/components/atoms/Abstract/Abstract";
import TextSimple from "@/components/atoms/TextSimple/TextSimple";
import Link from "@/components/atoms/Link/Link";

export default function Research() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Work in Progress" />
        <CardExtended title="A Foundation for Universalisation in Games">
          <Abstract
            content="Revealed preference theory equates choices to tastes. Nevertheless, if a moral principle prescribes an act for reasons unrelated to its consequences, the inference drawn regarding tastes is misleading. In this paper, I study the behaviour of deontological individuals who follow the moral principle of universalisation. They choose the action that, if chosen by everyone else as well, leads to their preferred outcome. I develop a decision theory for individuals who value the impact of their choice in determining a counterfactual outcome they envision. Choice is interpreted as revealing a preference for counterfactual outcomes. The theory can be specified to obtain the most prominent models of universalisation, compare them, highlight, and arguably overcome their limitations. I propose a unifying model of universalisation inspired by the equal sacrifice principle.  "
            availability="Draft [New version coming soon!]"
            link="/docs/draft_universalisation.pdf"
          />
        </CardExtended>
        <CardExtended title="Belief-dependent Motivations and Belief Updating">
          <Abstract content="I develop a theory of motivated belief updating. An individual who exhibits preferences for her beliefs faces a dynamic decision problem. Ex-ante behavior reveals that she anticipates she will distort her beliefs to satisfy her belief-dependent preferences. I provide assumptions that allow identifying preferences, prior beliefs, and departures from Bayesian updating. The theory rationalises excessive trading, the ostrich effect, and moral wiggle room." />
        </CardExtended>
        <CardExtended
          title="Can Pessimistic Beliefs Threaten Redistribution?"
          authors="Michele Bisceglia"
          links="https://www.tse-fr.eu/fr/people/michele-bisceglia"
        >
          <Abstract content="We develop and test a theory of how beliefs about other people's responsiveness to incentives shape preferences for redistribution. In a linear income taxation model where agents have heterogeneous prosocial preferences, more altruistic agents distort their labour supply to a lesser extent when the tax rate is higher. If agents have imperfect information on (the distribution of) preferences in the society, overly pessimistic beliefs imply a relatively low Condorcet-winner tax, even though most agents are poor and/or altruist. We develop an experimental design to test this prediction." />
        </CardExtended>
        <CardExtended title="Welfarist Meritocracy">
          <Abstract
            content="I develop a framework to conceptualise different understandings of meritocracy. A meritocracy is characterised by a metric of merit and a related reward system. Individuals obtain a higher reward when they score higher on the metric of merit. I focus on a strictly welfarist understanding of these two elements. An individual's action scores higher in the metric of merit than another if it leads to a pareto improvement in welfare. The reward for merit is individual welfare. I show that, under these two assumptions, for any collective action profile, there is a meritocratic reward system implementing it. I thus argue that meritocracy is a vacuous allocation rule when conceptualised through a purely welfarist lens. As a result, I propose that meritocracy should be viewed as a fundamentally non welfarist criterion."
            availability="Preliminary draft coming soon!"
          />
        </CardExtended>
      </PageSection>
      <PageSection>
        <SectionTitle text="Other Work" />
        <TextSimple content="I have some work in areas in the neighborhood of economics, but not quite there. You can find it here." />
        <CardExtended
          title="The Chaining Argument Unchained"
          authors="Annalisa Costella"
          links="https://www.annalisacostella.com/home"
        >
          <Abstract
            content="We argue that Chang's chaining argument against the Trichotomy Thesis relies on a notion of distance that is a trichotomous relation itself. Building from this insight, we show that the premises of the argument are inconsistent with each other and the argument is therefore unsound. Our result illuminates that the chaining argument does not provide insights into axiology."
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
    </main>
  );
}
