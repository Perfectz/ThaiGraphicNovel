type VnCharacterSprite = {
  id: string;
  image: string;
  alt: string;
  className: string;
};

type ChapterCharacterLayerProps = {
  characters: VnCharacterSprite[];
};

export function ChapterCharacterLayer({ characters }: ChapterCharacterLayerProps) {
  if (characters.length === 0) return null;

  return (
    <section className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {characters.map((character) => (
        <img
          key={character.id}
          src={character.image}
          alt={character.alt}
          className={`vn-character-sprite absolute bottom-[calc(var(--vn-panel-bottom)+var(--vn-panel-height)-1px)] object-contain object-bottom drop-shadow-[0_18px_32px_rgba(15,23,42,0.2)] ${character.className}`}
          decoding="async"
          draggable={false}
        />
      ))}
    </section>
  );
}
