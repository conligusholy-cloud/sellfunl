// 1) Přidej import na začátek souboru:
import AIAssistant from "./components/AIAssistant";

// 2) Přidej <AIAssistant /> těsně před uzavírací tag </BrowserRouter>
//    (nebo </Router>, nebo před poslední </div> v return)
//    Příklad:

function App() {
  return (
    <BrowserRouter>
      {/* ... všechny tvé routes ... */}
      <AIAssistant />   {/* ← přidej tento řádek */}
    </BrowserRouter>
  );
}