import Link from "@/components/atoms/Link/Link";
import PageSection from "@/components/atoms/PageSection/PageSection";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";

export default function Teaching() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Teaching" />
        <ul className="list-disc pl-8">
          <li>
            <Link href="/teaching/microeconomics" text="Microconomics I (Fall 2025)" size="text-l" target="_self" />
          </li>
          <li>
            <Link href="/teaching/topics-in-macro" text="Topics in Macro I (Fall 2020-2023)" size="text-l" target="_self" />
          </li>
        </ul>
      </PageSection>
    </main>
  );
}
