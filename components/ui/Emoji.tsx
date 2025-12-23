// Emoji component that renders Facebook-style emojis
interface EmojiProps {
  emoji: string; // Native emoji character (e.g., "❤️")
  size?: number; // Size in pixels (default: 20)
  className?: string;
}

// Convert emoji to unified codepoint format
function emojiToUnified(emoji: string): string {
  const codePoints = [];
  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i);
    if (code) {
      codePoints.push(code.toString(16));
      // Skip surrogate pair
      if (code > 0xFFFF) i++;
    }
  }
  return codePoints.join('-');
}

export default function Emoji({ emoji, size = 20, className = '' }: EmojiProps) {
  try {
    // Convert emoji to unified codepoint
    const unified = emojiToUnified(emoji);
    
    if (!unified) {
      // Fallback to native emoji if conversion fails
      return <span className={className} style={{ fontSize: `${size}px` }}>{emoji}</span>;
    }

    // Build the Facebook emoji image URL
    const imageUrl = `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@15.0.1/img/facebook/64/${unified}.png`;

    return (
      <img
        src={imageUrl}
        alt={emoji}
        width={size}
        height={size}
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
        onError={(e) => {
          // Fallback to native emoji on image load error
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const span = document.createElement('span');
          span.textContent = emoji;
          span.className = className;
          span.style.fontSize = `${size}px`;
          target.parentNode?.replaceChild(span, target);
        }}
      />
    );
  } catch (error) {
    // Fallback to native emoji on error
    return <span className={className} style={{ fontSize: `${size}px` }}>{emoji}</span>;
  }
}
