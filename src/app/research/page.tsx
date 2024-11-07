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
        <SectionTitle text="Job Market Paper" />
        <CardExtended title="Identifying Belief-dependent Preferences">
          <Abstract content="Why do investors avoid information or trade excessively due to overconfidence? Why do subjects in dictator games deliberately remain uninformed about the efficiency of their transfer? Possibly because their well-being is directly influenced by their beliefs, i.e., they have belief-dependent preferences. However, existing theories of belief-dependent preferences fail to generate testable predictions; in particular, identification of beliefs and preferences is not possible. This paper addresses this issue by providing an axiomatic characterization of a class of preferences and belief-updating rules that deviate from Bayesian updating. Preferences, beliefs and updating rules are identified from choices over contingent menus, each of which entails a set of menus of acts available at a later time contingent on an uncertain state of the world. The result provide a theory-based approach to experimental designs aiming at testing information avoidance and other behaviors consistent with belief-dependent preferences." 
          availability="Draft coming soon, available upon request."
          />
        </CardExtended>
        <SectionTitle text="Working Papers" />
        <CardExtended
          title="A Foundation for Universalisation in Games"
          titleHref="https://www.tse-fr.eu/sites/default/files/TSE/documents/doc/wp/2024/wp_tse_1586.pdf"
        >
          <Abstract
            content="Revealed preference theory equates choices with preferences over the consequences the choice induces. Nevertheless, if a decision criterion prescribes an act for reasons unrelated to its consequences, the inference drawn regarding preferences is misleading. I study the behaviour of non-consequentialist individuals who have preferences for universalisation. They choose the action that, in a counterfactual scenario in which it is chosen by everyone else as well, leads to their preferred consequences. I develop a model for individuals who value their choices in light of a counterfactual consequence these induce. Choice is interpreted as revealing a preference for counterfactual consequences. I impose axioms to single out the most prominent models of universalisation, compare them, highlight and arguably overcome their limitations. I propose a unifying model of universalisation inspired by the equal sacrifice principle."
            availability="Submitted"
          />
        </CardExtended>
        <SectionTitle text="Work in Progress" />
        <CardExtended
          title="Can Pessimistic Beliefs Threaten Redistribution?"
          authors="Michele Bisceglia"
          links="https://www.tse-fr.eu/fr/people/michele-bisceglia"
        >
          <Abstract content="We develop and test a theory of how beliefs about other people's responsiveness to incentives shape preferences for redistribution. In a linear income taxation model where agents have heterogeneous prosocial preferences, more altruistic agents distort their labour supply to a lesser extent when the tax rate is higher. If agents have imperfect information on (the distribution of) preferences in the society, overly pessimistic beliefs imply a relatively low Condorcet-winner tax, even though most agents are poor and/or altruist. We develop an experimental design to test this prediction."
          availability="Experiment will be run in the fall of 2025. Draft with theory and experimental design available upon request!"
          other = "Pre-registration"
          linkother = "https://osf.io/w3ep4"
           />
        </CardExtended>
        <CardExtended title="Welfarist Meritocracy">
          <Abstract
            content="I develop a framework to conceptualise different understandings of meritocracy. A meritocracy is characterised by a metric of merit and a related reward system. Individuals obtain a higher reward when they score higher on the metric of merit. I focus on a strictly welfarist understanding of these two elements. An individual's action scores higher in the metric of merit than another if it leads to a pareto improvement in welfare. The reward for merit is individual welfare. I show that, under these two assumptions, for any collective action profile, there is a meritocratic reward system implementing it. I thus argue that meritocracy is a vacuous allocation rule when conceptualised through a purely welfarist lens. As a result, I propose that meritocracy should be viewed as a fundamentally non welfarist criterion."
            availability="Preliminary draft coming soon, available upon request!"
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
       */}
    </main>
  );
}
