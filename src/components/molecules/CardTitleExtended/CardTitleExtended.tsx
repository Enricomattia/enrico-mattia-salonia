import CardTitle from "@/components/atoms/CardTitle/CardTitle";
import Authors from "../Authors/Authors";
import "./CardTitleExtended.style.css"
import Link from '@/components/atoms/Link/Link'; // Import your Link component

interface CardTitleExtendedProps {
  title: string;
  authors?: string;
  links?: string;
  titleHref?: string; // Add this line
}

const CardTitleExtended: React.FC<CardTitleExtendedProps> = ({
  title,
  authors,
  links,
  titleHref,
}) => {
  return (
    <div className="card-title-extended">
      <h3>
        {titleHref ? (
          <Link href={titleHref} text={title} size="text-l" />
        ) : (
          title
        )}
      </h3>
      {authors && <Authors authors={authors} links={links}/>}
    </div>
  );
};

export default CardTitleExtended;