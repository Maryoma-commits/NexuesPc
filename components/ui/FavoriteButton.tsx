import React from 'react';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  className = ''
}) => {
  return (
    <>
      <style>{`
        .fav-heart-btn {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 0;
        }
        .fav-input {
          display: none;
        }
        .fav-heart-label {
          box-sizing: border-box;
          position: relative;
          transform: rotate(-45deg) translate(-50%, -33px) scale(4);
          display: block;
          cursor: pointer;
          top: 0;
          border: 1px solid;
          border-color: hsl(231deg 28% 86%);
          border-top-left-radius: 100px;
          border-top-right-radius: 100px;
          width: 10px;
          height: 8px;
          border-bottom: 0;
          transition: all 0.3s ease;
        }
        .fav-heart-label::after {
          content: "";
          display: block;
          box-sizing: border-box;
          position: absolute;
          border: 1px solid;
          border-color: hsl(231deg 28% 86%);
          border-top-left-radius: 100px;
          border-top-right-radius: 100px;
          border-bottom: 0;
          width: 10px;
          height: 8px;
          right: -9px;
          transform: rotate(90deg);
          top: 7px;
          transition: all 0.3s ease;
        }
        .fav-heart-label .fav-bottom {
          content: "";
          display: block;
          box-sizing: border-box;
          position: absolute;
          width: 11px;
          height: 11px;
          border-left: 1px solid;
          border-bottom: 1px solid;
          border-color: hsl(231deg 28% 86%);
          left: -1px;
          top: 5px;
          border-radius: 0px 0px 0px 5px;
          transition: all 0.3s ease;
        }
        .fav-round {
          position: absolute;
          z-index: 1;
          width: 8px;
          height: 8px;
          background: hsl(0deg 0% 100%);
          box-shadow: rgb(0 0 0 / 24%) 0px 0px 4px 0px;
          border-radius: 100%;
          left: 0px;
          bottom: -1px;
          transition: all 0.5s ease;
          animation: fav-uncheck 0.5s forwards;
        }
        .fav-heart-btn.active .fav-round {
          transform: translate(0px, 0px);
          animation: fav-check 0.5s forwards;
          background-color: hsl(0deg 0% 100%);
        }
        .fav-heart-btn.active .fav-heart-label,
        .fav-heart-btn.active .fav-heart-label::after,
        .fav-heart-btn.active .fav-heart-label .fav-bottom {
          border-color: hsl(347deg 81% 61%);
          box-shadow: inset 6px -5px 0px 2px hsl(347deg 99% 72%);
        }
        @keyframes fav-check {
          0% { transform: translate(0px, 0px); }
          50% { transform: translate(0px, 7px); }
          100% { transform: translate(7px, 7px); }
        }
        @keyframes fav-uncheck {
          0% { transform: translate(7px, 7px); }
          50% { transform: translate(0px, 7px); }
          100% { transform: translate(0px, 0px); }
        }
      `}</style>
      <button
        type="button"
        className={`fav-heart-btn ${isFavorite ? 'active' : ''} ${className}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <span className="fav-heart-label">
          <i className="fav-bottom"></i>
          <div className="fav-round"></div>
        </span>
      </button>
    </>
  );
};
