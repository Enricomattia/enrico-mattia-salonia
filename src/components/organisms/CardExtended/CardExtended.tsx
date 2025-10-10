'use client';
import React, { useState } from 'react';
import Card from "@/components/atoms/Card/Card";
import CardTitleExtended from "@/components/molecules/CardTitleExtended/CardTitleExtended";
import IconButton from "@/components/atoms/IconButton/IconButton";
import CardHeading from "@/components/molecules/CardHeading/CardHeading";
import CardContent from "@/components/molecules/CardContent/CardContent";
import "./CardExtended.style.css";

import Image from "next/image";

interface CardExtendedProps {
  title: string;
  authors?: string;
  links?: string;
  titleHref?: string; // Add this line
  imageSrc?: string;
  children?: React.ReactNode;
}

const CardExtended: React.FC<CardExtendedProps> = ({
  title = "Card Title",
  authors,
  links,
  titleHref, // Add this line
  imageSrc,
  children,
}) => {
  // State to track whether the card is open or closed
  const [isOpen, setIsOpen] = useState(false);
  // Function to toggle the open/close state of the card
  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <Card>
      <CardHeading>
        <CardTitleExtended
          title={title}
          authors={authors}
          links={links}
          titleHref={titleHref} // Pass the prop here
        />
        <IconButton
          icon={isOpen ? "caret-up" : "caret-down"}
          onClick={toggleOpen}
        />
      </CardHeading>
      <CardContent state={isOpen ? "" : "closed"}>
        {imageSrc ? (
          <div className="card-content-grid">
            <div>{children}</div>
            <div className="image-container">
              <Image src={imageSrc} alt={title} width={500} height={300} />
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

export default CardExtended;
