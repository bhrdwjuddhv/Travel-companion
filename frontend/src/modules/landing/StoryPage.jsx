import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { STORIES } from '../../constants';

/**
 * Where a book on the shelf opens to. A placeholder: it shows what the shelf
 * already knows about the story, and nothing is written or fetched yet.
 */
export default function StoryPage() {
  const { storyId } = useParams();
  const story = STORIES.items.find((s) => s.id === storyId);

  if (!story) {
    return (
      <main className="poster grid min-h-screen place-items-center p-6">
        <p className="ui-prose">No such story.</p>
      </main>
    );
  }

  return (
    <main className="poster min-h-screen">
      <div className="ui-section ui-measure">
        <Link to="/" className="ui-pill inline-flex">
          <ArrowLeft size={15} />
          Back to the shelf
        </Link>

        <article className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <img
            src={story.cover}
            alt={story.place}
            className="aspect-[474/600] w-full rounded-[var(--r-lg)] object-cover shadow-[var(--c-shadow-raised)]"
          />

          <div>
            <span className="poster-eyebrow">{story.place}</span>
            <h1 className="ui-h2 mt-5">{story.title}</h1>
            <p className="ui-eyebrow mt-3 block uppercase">
              {story.author} · {story.meta}
            </p>
            <p className="ui-prose mt-6 text-[length:var(--type-body)]">{story.excerpt}</p>
            {/* ponytail: the write-up itself is not built yet. */}
            <p className="ui-prose mt-6 text-[length:var(--type-small)] italic">
              The rest of this write-up is still to come.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
