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
      "We develop and test a theory of how beliefs about others' responsiveness to incentives shape preferences for redistribution. In an income taxation model with heterogeneous prosocial preferences, effort distortions from higher taxes are smaller among more prosocial individuals. As a result, pessimistic beliefs about others' prosociality can reduce equilibrium redistribution even when most individuals are poor or altruistic. In a laboratory experiment, however, providing information about others' prosocial behavior does not increase support for redistribution among pessimists, whereas it reduces it among optimists. This asymmetric response is associated with a positive correlation between prosocial behavior and optimistic beliefs, consistent with social projection or self-serving pessimistic beliefs.",
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
    id: "ato",
    title: "A Theory of Acting against the Odds",
    status: "Submitted",
    coauthor: { name: "Annalisa Costella", href: "https://www.annalisacostella.com/home" },
    draftOnRequest: true,
    abstract:
      "We develop a decision-theoretical account of acting against the odds, built around the normatively compelling feature of this behaviour: its agential character. We provide the first argument of why acting against the odds is in need of a distinct decision-theoretic treatment, showing how and why prominent existing theories of rational decision-making fail to make sense of simple and paradigmatic cases of acting against the odds. Our account shows that, pace current consensus, acting against the odds need not imply believing against the odds. As we demonstrate, and as it is in our account, an individual who acts against the odds can be Bayesian.",
    tex: String.raw`U(M) = \max_{f\in M}\left\{\sum_s p_s\,u(f_s) + \alpha \sum_s\left(f_s(x_f) - \frac{1}{|M|}\sum_{f'\in M} f'_s(x_{f'})\right)\right\}`,
  },
  {
    id: "chang",
    title: "The Chaining Argument Unchained",
    status: "Submitted",
    coauthor: { name: "Annalisa Costella", href: "https://www.annalisacostella.com/home" },
    abstract:
      "We argue that the chaining argument is either unsound or question-begging. Contrary to existing claims, it cannot serve as a basis to adjudicate whether the conceptual space of value relations is exhausted by the standard trichotomous ones. We offer two formal reconstructions of the argument. Reconstructing the argument in a way that is faithful to its natural-language counterpart reveals that the premises are mutually inconsistent, making the argument unsound. A more liberal reconstruction shows that the argument can preserve soundness at the cost of becoming question-begging. Under both interpretations, we show that the transitivity of comparability is implied, which independently trivialises the argument. Our analysis further suggests that spectrum-like arguments may be in no position to use, or vindicate, unconventional value relations, directing researchers interested in unconventional value relations toward alternative arguments.",
    tex: String.raw`[(xR_v y \ \text{or}\ yR_v x)\ \&\ (yR_d z\ \text{or}\ zR_d y)] \implies (xR_v z\ \text{or}\ zR_v x)`,
  },
];
