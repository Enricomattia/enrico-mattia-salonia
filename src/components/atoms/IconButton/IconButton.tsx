import "./IconButton.style.css";

interface IconButtonProps {
  icon: string;
  onClick?: () => void;
}

const IconButton: React.FC<IconButtonProps> = ({ icon = "caret-down", onClick }) => {
  return <button onClick={onClick} aria-label={icon}><i className = {icon}></i></button>;
};

export default IconButton;
