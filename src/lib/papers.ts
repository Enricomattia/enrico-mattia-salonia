// All research papers, with abstracts and equations transcribed verbatim from
// the source .tex files. `tex` strings use String.raw so backslashes are literal.

export interface PaperLink {
  label: string;
  href: string;
}

export interface Paper {
  id: string;
  title: string;
  status: string; // mono uppercase line shown when collapsed
  coauthor?: { name: string; href: string };
  ssrn?: string; // full URL; rendered as "[ SSRN ↗ ]" right after the title
  extraLinks?: PaperLink[]; // shown in the open body
  draftOnRequest?: boolean; // shows "Draft available upon request" in the open body
  abstract: string;
  tex: string;
}

export const papers: Paper[] = [
  {
    id: "bdp",
    title: "Identifying Belief-dependent Preferences",
    status: "Working paper",
    ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5273829",
    abstract:
      "Belief-dependent preferences — where an individual's well-being depends directly on her beliefs — have been proposed to explain phenomena such as information avoidance, overconfidence, and polarisation. However, existing theories of belief-dependent preferences struggle to generate testable predictions or to simultaneously identify beliefs and preferences. This paper addresses these issues by providing an axiomatic characterisation of a class of preferences and belief-updating rules that deviate from Bayesian updating. Preferences, beliefs, and updating rules are identified from choices over contingent menus, each comprising a menu of acts available at a later time contingent on an uncertain state of the world. The results provide a theory-based approach to experimental designs for testing information avoidance, distortion, and other behaviours consistent with belief-dependent preferences.",
    tex: String.raw`\begin{aligned}\mathscr{U}(F) &= \sum_{M}\sum_{s} p(s)\,F_s(M)\,\mathcal{U}(M;\ell_{M,F}),\\[2pt] \mathcal{U}(M;\ell) &= \max_{f\in M}\left[\sum_s p_\ell(s)\,u(f_s;\ell) + \alpha_\ell \sum_s p_{\ell^*_{S_\ell}}(s)\,u(f_s;\ell^*_{S_\ell})\right]\\ &\quad - \alpha_\ell \max_{f'\in M}\sum_s p_{\ell^*_{S_\ell}}(s)\,u(f'_s;\ell^*_{S_\ell})\end{aligned}`,
  },
  {
    id: "up",
    title: "A Foundation for Universalisation in Games",
    status: "Working paper — new version coming soon",
    ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5284245",
    abstract:
      "I study the behaviour of individuals who have preferences for universalisation. When considering a course of action, they evaluate the consequence that would occur if everyone else acted equivalently, according to some criterion of equivalence. That is, they universalise their behaviour. I develop and axiomatise a model for individuals who value their choices in light of the consequences they induce when their action is universalised. The key behavioural prediction is that the independence axiom is satisfied only among actions that are universalised equivalently. I impose conditions to single out the most prominent models of universalisation, compare them, highlight and arguably overcome their limitations. I propose a unifying model of universalisation inspired by the equal sacrifice principle.",
    tex: String.raw`\begin{aligned}U_i(\alpha_i) = {} & (1-\kappa) \sum_{a_i, a_{-i}} \alpha_i(a_i)\,\mu_{i}(a_{-i})\,u_i(c(a_i, a_{-i})) \\ & + \kappa \sum_{a_i, a_{-i}} \alpha_i(a_i)\,T(\alpha_i)(a_{-i})\,u_i(c(a_i, a_{-i}))\end{aligned}`,
  },
  {
    id: "red",
    title: "Prosocial Preferences, Beliefs, and Demand for Redistribution",
    status: "Submitted",
    coauthor: {
      name: "Michele Bisceglia",
      href: "https://sites.google.com/view/michele-bisceglia/home-page",
    },
    ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7020898",
    extraLinks: [
      { label: "[ Pre-registration ↗ ]", href: "https://osf.io/w3ep4" },
      {
        label: "[ Replication ↗ ]",
        href: "https://drive.google.com/drive/folders/1R5woAWLCNHdJJ4QScItmarcXJrWoHhWL?usp=drive_link",
      },
    ],
    abstract:
      "We develop and test a theory of how beliefs about others' responsiveness to incentives shape preferences for redistribution. In an income taxation model with heterogeneous prosocial preferences, effort distortions from higher taxes are smaller among more prosocial individuals. As a result, pessimistic beliefs about others' prosociality can reduce equilibrium redistribution even when most individuals are poor or altruistic. In a laboratory experiment, however, providing information about others' prosocial behavior does not increase support for redistribution among pessimists, whereas it reduces it among optimists. This asymmetric response is attributable to correlation between prosocial preferences and optimistic beliefs, suggesting that selfish individuals form self-serving beliefs that rationalize their choice of low redistribution.",
    tex: String.raw`u_i(\cdot) \equiv (1-\tau)\theta_i x_i - \Psi(x_i) + \alpha_i\tau\theta_i x_i + (1+\beta_i)\tau\int_{0}^{1} \theta_h x_h\,dh`,
  },
  {
    id: "mer",
    title: "Meritocracy as an End and as a Means",
    status: "Working paper — new version coming soon",
    ssrn: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5281750",
    abstract:
      "I introduce a framework for studying different interpretations of meritocracy. Each meritocracy has two components: a merit criterion, which determines when one individual is more meritorious than another, and a reward criterion, which determines when one outcome is more rewarding for a given individual. An allocation is meritocratic if more meritorious individuals are more highly rewarded. The framework distinguishes between meritocracy as an end, in which rewarding meritorious preferences is intrinsically valuable, and meritocracy as a means, in which rewarding meritorious actions is instrumentally valuable for achieving desirable outcomes. I show that these two conceptions are equivalent: any merit criterion over actions in a mechanism that yields meritorious outcomes must reduce to an underlying merit criterion over preferences. I apply the framework to two specific conceptions of meritocracy. Pareto meritocracy, according to which an action is more meritorious if it leads to a Pareto improvement, turns out to be vacuous, imposing virtually no constraints on allocations. Proportional meritocracy, according to which each individual's consumption is proportional to labour input, is characterised by three conditions: monotonicity of the merit criterion in labour, scale invariance, and a welfarist reward criterion.",
    tex: String.raw`\succsim_i M \succsim'_i \implies f(\succsim_i,\succsim_{-i})\,R_i\,f(\succsim'_i,\succsim_{-i})`,
  },
  {
    id: "chang",
    title: "The Chaining Argument Unchained",
    status: "Submitted",
    coauthor: { name: "Annalisa Costella", href: "https://www.annalisacostella.com/home" },
    draftOnRequest: true,
    abstract:
      "We argue that the chaining argument against the Trichotomy Thesis is on the horns of a dilemma. Either it is vacuous or it is unsound. Contrary to what it has been commonly assumed, it cannot be used as a reliable basis to adjudicate whether parity does or does not obtain. Stating the premises in a formal syntax that makes them consistent with each other deprives them of their intended meaning and makes the argument vacuous. If, instead, the premises of the argument are expressed in the weakest formal syntax to capture their meaning, the argument is unsound since its premises are inconsistent with each other. Besides demonstrating that the chaining argument does not provide insights into axiology, our result helps orient those interested in proving the existence of parity as a value relation towards alternative arguments.",
    tex: String.raw`[(xR_v y \ \text{or}\ yR_v x)\ \&\ (yR_d z\ \text{or}\ zR_d y)] \implies (xR_v z\ \text{or}\ zR_v x)`,
  },
  {
    id: "ato",
    title: "A Theory of Acting against the Odds",
    status: "Submitted",
    coauthor: { name: "Annalisa Costella", href: "https://www.annalisacostella.com/home" },
    draftOnRequest: true,
    abstract:
      "Acting against the odds has been understood as acting despite evidence that one is unlikely to succeed. The existing literature reduces the rationality of this behaviour to the rationality of believing against the odds. We argue that the current definition of this behaviour is insufficiently precise and show that this reduction is neither necessary nor sufficient to explain the phenomenon. We develop a decision-theoretic framework separating tastes over outcomes, beliefs over uncertain states, and a taste for agency — the value of increasing one's likelihood of success through one's own choice relative to other available actions. We show that the taste for agency violates the independence axiom and is inconsistent with expected utility, rank-dependent utility, or other theories evaluating risky prospects in isolation. Because the taste for agency is independent of belief formation and updating, an individual who acts against the odds need not be an unconventional reasoner — she may be Bayesian.",
    tex: String.raw`U(M) = \max_{f\in M}\left\{\sum_s p_s\,u(f_s) + \alpha \sum_s\left(f_s(x_f) - \frac{1}{|M|}\sum_{f'\in M} f'_s(x_{f'})\right)\right\}`,
  },
];
