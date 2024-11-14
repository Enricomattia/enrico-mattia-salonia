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
        <SectionTitle text="Topics in Macro I (Website for students)" />
        <TextSimple content="Welcome to the class website! Here I will post the material I produce for the course, namely solutions to exercises and maybe some extras that could be useful. Contact me if you have any questions!" />
        {/*
        <WarningPanel
          title="Attention!"
          content="There could be mistakes, use the official solutions as a reference! Feel free to point out any typos, mistakes, or answers that are not clear. If you want you can check the plan (NEW 15/11/2023!) for the lectures. Solutions will come out lecture by lecture. If you obtained solutions from other sources, don’t consult them! You will do way better on the exam if you attempt to do the exercises yourself before the lecture."
          linktext="Check the plan!"
          link="/teaching/Plan_20232024.html"
        />
        */}
        <CardExtended title="Lectures">
        <Class
            title="Plan"
            linkToDoc="/teaching/Plan_20232024.html"
          />
          <Class
            title="TD1"
            linkToDoc="/teaching/TD1.html"
            linkToPdf="/teaching/tds/TD1.pdf"
          />
          <Class
            title="TD2"
            linkToDoc="/teaching/TD2.html"
            linkToPdf="/teaching/tds/TD2.pdf"
          />
          <Class
            title="TD3"
            linkToDoc="/teaching/TD3.html"
            linkToPdf="/teaching/tds/TD3.pdf"
          />
          <Class
            title="TD4"
            linkToDoc="/teaching/TD4.html"
            linkToPdf="/teaching/tds/TD4.pdf"
          />
          <Class
            title="TD5"
            linkToDoc="/teaching/TD5.html"
            linkToPdf="/teaching/tds/TD5.pdf"
          />
          <Class
            title="TD6"
            linkToDoc="/teaching/TD6.html"
            linkToPdf="/teaching/tds/TD6.pdf"
          />
          <Class
            title="TD7"
            linkToDoc="/teaching/TD7.html"
            linkToPdf="/teaching/tds/TD7.pdf"
          />
          <Class
            title="TD8"
            linkToDoc="/teaching/TD8.html"
            linkToPdf="/teaching/tds/TD8.pdf"
          />
          <Class
            title="TD9"
            linkToDoc="/teaching/TD9.html"
            linkToPdf="/teaching/tds/TD9.pdf"
          />
          <Class
            title="A Solarian Malthus Model"
            linkToDoc="/teaching/SolariaSOL.html"
            linkToPdf="/teaching/tds/A_Solarian_Malthus_Model_Solution.pdf"
          />
        </CardExtended>
        <CardExtended title="Extras">
          <TextSimple content="If you click on the link below, you will find a code that solves and plots the Solow-Swan model! I tried to make it as straightforward as possible by including instructions. Just click on the link and see if you can play around with the code. Good luck!" />
          <Link
            href="https://mybinder.org/v2/gh/Enricomattia/TopicsInMacro1TD/HEAD?filepath=solow-swan.ipynb"
            text="Jupyter Notebook - Solow-Swan Model"
            size="text-m"
          />
          <TextSimple content="Here you can find the solutions to the 2020 and 2019 midterms. However, I strongly suggest you focus on the class and TD material before attempting it!" />
          <Class 
            title="Midterm 2020" 
            linkToPdf="/teaching/tds/Midterm_2020.pdf" />
          <Class 
            title="Baby Boom" 
            linkToPdf="/teaching/tds/Baby_boom.pdf" />
        </CardExtended>
      </PageSection>
    </main>
  );
}
