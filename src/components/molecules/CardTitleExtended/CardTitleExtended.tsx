import Authors from "../Authors/Authors";
import "./CardTitleExtended.style.css"
import Link from '@/components/atoms/Link/Link'; // Import your Link component

interface CardTitleExtendedProps {
  title: string;
  authors?: string;
  links?: string;
  titleHref?: string; // Add this line
  status?: string;
}

const CardTitleExtended: React.FC<CardTitleExtendedProps> = ({
  title,
  authors,
  links,
  titleHref,
  status,
}) => {
  return (
    <div className="card-title-extended">
      <h3 className="card-title-extended-main">
        {titleHref ? (
          <Link href={titleHref} text={title} size="text-l" />
        ) : (
          title
        )}
      </h3>
      {status && <span className="card-title-extended-status text-s">{status}</span>}
      {authors && <Authors authors={authors} links={links}/>}
    </div>
  );
};

export default CardTitleExtended;