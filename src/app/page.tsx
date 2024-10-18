"use client";
import Img from "@/components/molecules/Img/Img";
import Link from "@/components/atoms/Link/Link";
import useWindowDimensions from "@/hooks/useWindowDimensions";

export default function Home() {
  const { width } = useWindowDimensions();
  const mainClass = width && width < 800 ? "main col" : "main row";
  const imgWidth = width && width < 700 ? 300 : 500;
  const afterClass = useWindowDimensions();

  return (
    <main className={mainClass}>
      <Img
        src="/img/kangaroo.webp"
        alt="Enrico Mattia Salonia in Australia with a Kangaroo"
        width={imgWidth}
        caption=""
      />
      <p>
        I am a fifth-year PhD student at <br />{" "}
        <Link
          href="https://www.tse-fr.eu/"
          text="Toulouse School of Economics"
        />
        .
        <br />
        <br />
        I will be on the 2024-25 academic job market.
        <br />
        <br />
        I am mainly interested in microeconomic theory, <br /> behavioral and
        experimental economics.
        <br />
        <br />
        Here is my <Link href="/docs/cv.pdf" text="CV" />.
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
        <p>Ciao</p>
      </div>
    */}
    </main>
  );
}
