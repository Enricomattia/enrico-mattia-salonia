import "./CardTitle.style.css";
import Link from "@/components/atoms/Link/Link";

interface CardTitleProps {
  title: string;
  href?: string;
}

const CardTitle: React.FC<CardTitleProps> = ({ title = "Title", href }) => {
  return (
    <h3 className="card-title text-m">
      {href ? (
        <Link href={href} text={title} size="text-m" />
      ) : (
        title
      )}
    </h3>
  );
};

export default CardTitle;
