import { Monogram } from "../../../shared/components/Monogram";

interface PresetMonogramProps {
  id: number;
  name: string;
}

/** Монограмма пресета для строки списка. У пресетов нет картинок — цвет и буква их единственный «якорь». */
export function PresetMonogram({ id, name }: PresetMonogramProps) {
  return <Monogram id={id} name={name} size={48} />;
}
