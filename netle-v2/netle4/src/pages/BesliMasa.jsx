import { useEffect } from "react";

export default function BesliMasa({ setEkran }) {
  useEffect(() => {
    setEkran("yaris");
  }, []);
  return null;
}
