import Link from "@/components/atoms/Link/Link";
import PageSection from "@/components/atoms/PageSection/PageSection";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";

export default function Teaching() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Classes" />
        <ul className="list-disc pl-8 flex flex-col gap-y-3">
          <li>
            <Link
              href="/teaching/microeconomics"
              text="Microeconomics I (Fall 2025), First year PhD Tor Vergata"
              size="text-l"
              target="_self"
            />
          </li>
          <br />
          <li>
            <Link
              href="/teaching/topics-in-macro"
              text="Topics in Macro I (Fall 2020-2023), Third year bachelor Toulouse"
              size="text-l"
              target="_self"
            />
          </li>
        </ul>
      </PageSection>
    </main>
  );
}
