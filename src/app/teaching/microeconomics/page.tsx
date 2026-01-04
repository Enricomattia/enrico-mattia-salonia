import PageSection from "@/components/atoms/PageSection/PageSection";
import CardExtended from "@/components/organisms/CardExtended/CardExtended";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";
import TextSimple from "@/components/atoms/TextSimple/TextSimple";
import WarningPanel from "@/components/molecules/WarningPanel/WarningPanel";
import Class from "@/components/molecules/Class/Class";
import Link from "@/components/atoms/Link/Link";

export default function Teaching() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Microeconomics I" />
        <TextSimple content="Welcome to the class website!" />
        {/*
        <WarningPanel
          title="Attention!"
          content="There could be mistakes, use the official solutions as a reference! Feel free to point out any typos, mistakes, or answers that are not clear. If you want you can check the plan (NEW 15/11/2023!) for the lectures. Solutions will come out lecture by lecture. If you obtained solutions from other sources, don’t consult them! You will do way better on the exam if you attempt to do the exercises yourself before the lecture."
          linktext="Check the plan!"
          link="/teaching/Plan_20232024.html"
        />
        */}
        <a href="/notes/main.pdf" target="_blank" rel="noreferrer">
            Lecture Notes
        </a>
        <span style={{ display: "inline-block", width: 14 }} />
        <span className="opacity-60">•</span>
        <span style={{ display: "inline-block", width: 14 }} />
        <a href="/docs/solutions_micro.pdf" target="_blank" rel="noreferrer">
            Solutions
        </a>
      </PageSection>
    </main>
  );
}
