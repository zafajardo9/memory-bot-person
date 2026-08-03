import { motion } from "framer-motion";
import { BookOpen, FileSearch, NotebookPen, ShieldCheck } from "lucide-react";

const capabilities = [
  { icon: FileSearch, title: "Searches first", text: "Finds the most relevant notes, files, and links before answering." },
  { icon: ShieldCheck, title: "Grounded answers", text: "Company claims come from trusted memory and include citations." },
  { icon: NotebookPen, title: "Learns together", text: "Your whole team can capture context in the shared notebook." },
];

export const Overview = () => {
  return (
    <motion.div key="overview" className="mx-4 mt-28 w-[calc(100%-32px)] max-w-3xl" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <div className="pb-8 text-left sm:pb-10">
        <p className="eyebrow">Company notebook / Ask</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Company memory,<br className="hidden sm:block" /> with the source attached.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Ask a question and get a direct answer grounded in the notes, files, and links your team has approved.</p>
      </div>
      <div className="grid sm:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, text }) => <div key={title} className="py-4 sm:px-6 sm:first:pl-0"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={16} /></span><h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>)}
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><BookOpen size={13} /> Every company claim can be traced to its source.</div>
    </motion.div>
  );
};
