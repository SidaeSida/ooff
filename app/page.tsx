export const dynamic = "force-dynamic"; // 매 요청마다 랜덤 새로 고름

const imgs = ["/main1.jpg", "/main2.jpg", "/main3.jpg", "/main4.jpg"];

export default function Home() {
  const src = imgs[Math.floor(Math.random() * imgs.length)];
  return (
    <section className="p-0">
      <img
        src={src}
        alt="OOFF cover"
        className="w-full h-auto block rounded-md"
      />
    </section>
  );
}
