// Filter overlay component for toggling type and epic visibility
import { useBmfStore } from '../store/bmfStore';
import { getTypeColor, getEpicColor } from '../utils/colorHash';

export function FilterOverlay() {
  const availableTypes = useBmfStore((s) => s.availableTypes);
  const availableEpics = useBmfStore((s) => s.availableEpics);
  const hiddenTypes = useBmfStore((s) => s.hiddenTypes);
  const hiddenEpics = useBmfStore((s) => s.hiddenEpics);
  const toggleType = useBmfStore((s) => s.toggleType);
  const toggleEpic = useBmfStore((s) => s.toggleEpic);

  if (availableTypes.length === 0 && availableEpics.length === 0) {
    return null;
  }

  return (
    <div className="filter-overlay">
      <div className="filter-section">
        <div className="filter-section-title">Types</div>
        <div className="filter-badges">
          {availableTypes.map((type) => {
            const isHidden = hiddenTypes.has(type);
            const color = getTypeColor(type);
            return (
              <button
                key={type}
                className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                style={{
                  backgroundColor: isHidden ? 'transparent' : color,
                  borderColor: color,
                }}
                onClick={() => toggleType(type)}
                title={isHidden ? `Show ${type}` : `Hide ${type}`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {availableEpics.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-title">Epics</div>
          <div className="filter-badges">
            {availableEpics.map((epic) => {
              const isHidden = hiddenEpics.has(epic);
              const color = getEpicColor(epic);
              return (
                <button
                  key={epic}
                  className={`filter-badge ${isHidden ? 'filter-badge-hidden' : ''}`}
                  style={{
                    backgroundColor: isHidden ? 'transparent' : color,
                    borderColor: color,
                  }}
                  onClick={() => toggleEpic(epic)}
                  title={isHidden ? `Show ${epic}` : `Hide ${epic}`}
                >
                  {epic}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
