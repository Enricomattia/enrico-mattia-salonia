import type { Metadata } from "next";
import TrackedLink from "@/components/TrackedLink";
import styles from "./workshop.module.css";

export const metadata: Metadata = {
  title: "Value Beyond Preferences | Enrico Mattia Salonia",
  description:
    "Call for papers: an economics and philosophy workshop at the University of Rome Tor Vergata on March 19, 2027. Submit by December 6, 2026.",
};

export default function ValueBeyondPreferences() {
  return (
    <main className="site-main">
      <article className={styles.workshop}>
        <h1>Value Beyond Preferences</h1>
        <p>
          We are pleased to invite submissions for the upcoming interdisciplinary workshop{" "}
          <strong>“Value Beyond Preferences”</strong>, to be held on{" "}
          <strong><time dateTime="2027-03-19">March 19, 2027</time></strong>, at the{" "}
          <strong>University of Rome Tor Vergata (Department of Economics), Italy</strong>.
        </p>

        <h2>Keynote speakers</h2>
        <p>We are delighted to announce our keynote speakers:</p>
        <ul>
          <li><strong>H. Orri Stefánsson</strong> (Stockholm University)</li>
          <li><strong>Paolo Giovanni Piacquadio</strong> (University of St. Gallen)</li>
        </ul>
        <p>
          The workshop is generously funded by the{" "}
          <strong>International Network for Economic Method (INEM)</strong>.
        </p>

        <h2>Workshop description</h2>
        <p>
          The workshop aims to bring together economists and philosophers to explore fundamental
          questions about the nature of value and its representation, comparison, and aggregation.
        </p>
        <p>
          In economics, value is traditionally understood and represented through individual or
          social preferences. In philosophy, there is a long-standing tradition investigating
          different conceptions of value (from hedonism to objective list) and ways in which goods
          may be valuable (intrinsic, extrinsic, instrumental, constitutive, and so on).
        </p>
        <p>
          This workshop seeks to foster an interdisciplinary dialogue on what economics can learn
          from philosophical theories of value and, conversely, how the formal and methodological
          tools developed in economics can contribute to philosophical inquiry.
        </p>
        <p>Three core themes are of interest to the workshop:</p>
        <ol>
          <li>
            <strong>Conceptualizing Value:</strong> What makes something valuable, and how should
            value be understood?
          </li>
          <li>
            <strong>Representing and Comparing Value:</strong> How should value be measured and
            compared?
          </li>
          <li>
            <strong>Aggregating Value:</strong> How should value be aggregated, both within and
            across individuals?
          </li>
        </ol>

        <h2>Call for papers</h2>
        <p>
          We invite paper submissions from scholars working in economics, philosophy, and related
          disciplines. We welcome contributions addressing any aspect of the workshop&apos;s
          themes, broadly construed. The workshop will feature up to <strong>six contributed talks</strong>.
        </p>
        <p>
          We particularly encourage submissions from early-career scholars and members of
          underrepresented groups. Thanks to INEM&apos;s generous support,{" "}
          <strong>limited financial assistance for travel and accommodation</strong> will be
          available, with priority given to early-career researchers and participants without
          access to institutional funding.
        </p>
        <p>
          Please submit your paper by{" "}
          <strong><time dateTime="2026-12-06">December 6, 2026</time></strong>, via this{" "}
          <TrackedLink
            href="https://forms.gle/92dKkZvP7gMYW6956"
            target="_blank"
            rel="noopener noreferrer"
            eventName="workshop_submission_click"
            tags={{ workshop: "Value Beyond Preferences" }}
          >
            submission form
          </TrackedLink>
          .
        </p>
        <p>
          We aim to communicate our decisions by{" "}
          <strong><time dateTime="2026-12-18">December 18, 2026</time></strong>.
        </p>
        <p>
          For further information, please contact{" "}
          <TrackedLink
            href="mailto:mattia.salonia1@gmail.com"
            eventName="mailto_click"
            tags={{ link_type: "workshop_email" }}
          >
            mattia.salonia1@gmail.com
          </TrackedLink>
          .
        </p>

        <h2>Organizers</h2>
        <ul>
          <li>
            <TrackedLink
              href="https://www.annalisacostella.com/"
              target="_blank"
              rel="noopener noreferrer"
              eventName="workshop_organizer_click"
              tags={{ workshop: "Value Beyond Preferences" }}
            >
              Annalisa Costella
            </TrackedLink>{" "}
            (Vrije Universiteit Amsterdam)
          </li>
          <li>Enrico Mattia Salonia (University of Rome Tor Vergata)</li>
        </ul>
      </article>
    </main>
  );
}
