"use client";
import Img from "@/components/molecules/Img/Img";
import Link from "@/components/atoms/Link/Link";
import useWindowDimensions from "@/hooks/useWindowDimensions";

export default function Home() {
  const { width } = useWindowDimensions();
  const mainClass = width && width < 800 ? "main col" : "main row";
  const imgWidth = width && width < 500 ? 500 : 400;
  const afterClass = useWindowDimensions();

  return (
    <main className={mainClass}>
      <Img
        src="/img/kangaroo.webp"
        alt="Enrico Mattia Salonia in Australia with a Kangaroo"
        width={imgWidth}
        caption="A kangaroo escaping from me talking about game theory"
      />
      <p>
        I am a PhD candidate at <br />{" "}
        <Link
          href="https://www.tse-fr.eu/"
          text="Toulouse School of Economics"
        />
        .
        <br />
        <br />
        I mainly work in microeconomic theory, <br /> behavioral and
        experimental economics.
        <br />
        <br />
        Here you can find my <Link href="/docs/cv.pdf" text="CV" />.
        <br />
        <br />
        Contact me at <br />
        <Link
          href="mailto:mattia.salonia@tse.fr"
          text="mattia.salonia@tse.fr"
        />{" "}
        or <br />
        <Link
          href="mailto:mattia.salonia1@gmail.com"
          text="mattia.salonia1@gmail.com"
        />
      </p>
      {/*
      <div className="additional-text">
        <p> I study how the design of information and incentives <br /> can soften inefficiencies in financial markets. I am working on bank stress tests, risk management, <br /> and algorithmic opacity in credit markets.
        </p>
      </div>
    */}
    </main>
  );
}
