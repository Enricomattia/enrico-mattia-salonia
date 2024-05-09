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
        <SectionTitle text="Work in Progress"/>
        <CardExtended title="A Foundation for Universalisation in Games">
          <Abstract 
            content="In revealed preference theory, observed choice is interpreted as revealing tastes over the outcomes of the decision. Nevertheless, if a moral principle prescribes an act for reasons unrelated to its consequences, the inference drawn regarding preferences is misleading. In this paper, I study the behaviour of deontological decision makers who follow the moral principle of universalisation. I develop a decision theory for agents who value the impact of their choice in determining a counterfactual outcome they envision. Hence, the choice of action reveals a preference for counterfactual outcomes. I propose a unifying model based on my theory, inspired by the equal sacrifice principle. It can be specified to obtain the most prominent models of universalisation, compare them, highlight and arguably overcome their limitations."
            availability="Draft [New version coming soon!]"
            link="/docs/draft_universalisation.pdf"
          />
        </CardExtended>
        <CardExtended title="Belief-dependent Motivations and Belief Updating">
          <Abstract content="I develop a theory of motivated belief updating. An individual who exhibits preferences for her beliefs faces a dynamic decision problem. Ex-ante behavior reveals that she anticipates she will distort her beliefs to satisfy her belief-dependent preferences. I provide assumptions that allow identifying preferences, prior beliefs, and departures from Bayesian updating. The theory rationalises excessive trading, the ostrich effect, and moral wiggle room."/>
        </CardExtended>
        <CardExtended title="Can Pessimistic Beliefs Threaten Redistribution?" authors="Michele Bisceglia" links="https://www.tse-fr.eu/fr/people/michele-bisceglia">
          <Abstract content="We develop and test a theory of how beliefs about other people's responsiveness to incentives shape preferences for redistribution. In a linear income taxation model where agents have heterogeneous prosocial preferences, more altruistic agents distort their labour supply to a lesser extent when the tax rate is higher. If agents have imperfect information on (the distribution of) preferences in the society, overly pessimistic beliefs imply a relatively low Condorcet-winner tax, even though most agents are poor and/or altruist. We develop an experimental design to test this prediction."/>
        </CardExtended>
      </PageSection>
      <PageSection>
        <SectionTitle text="Other Work"/>
        <TextSimple content="I have some work in areas in the neighborhood of economics, but not quite there. You can find it here."/>
        <CardExtended title="The Chaining Argument Unchained" authors="Annalisa Costella" links="https://www.annalisacostella.com/home">
          <Abstract content="We show that formalising Chang's chaining argument against the Trichotomy Thesis demonstrates that the intuitive pull of the argument relies on exploiting the features of a notion of closeness that is, however, a trichotomous relation itself. As such, the premises of the argument are inconsistent with each other, and the argument is unsound. Our results illuminate that the chaining argument does not provide insights into axiology."/>
        </CardExtended>
      </PageSection>
      <PageSection>
        <SectionTitle text="Book Review"/>
        <CardExtended title="Review of Ivan Moscati’s Measuring Utility: From the Marginal Revolution to Behavioral Economics" authors="Annalisa Costella" links="https://www.annalisacostella.com/home">
          <Link text="Link" href="https://ejpe.org/journal/article/view/469/337" size="text-m" />
        </CardExtended>
      </PageSection>
    </main>
  );
}
