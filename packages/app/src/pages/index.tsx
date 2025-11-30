const HomePage = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="navbar">
        <div className="w-full text-center">
          <div className="text-xl normal-case">YouTube</div>
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-lg px-4 text-center">
          <h1 className="mb-6 text-3xl font-bold">Paste your URL</h1>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://example.com"
              className="input input-bordered w-full"
            />
            <button className="btn btn-primary">Submit</button>
          </div>
        </div>
      </main>
      <footer className="footer footer-center text-base-content p-4">
        <aside>
          <p>© 2025 YouTube — All rights reserved</p>
        </aside>
      </footer>
    </div>
  );
};

export default HomePage;
