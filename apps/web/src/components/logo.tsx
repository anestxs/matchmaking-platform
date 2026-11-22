import Image from 'next/image';

type LogoProps = {
  size?: number;
  priority?: boolean;
};

export function Logo({ size = 40, priority = false }: LogoProps) {
  return (
    <>
      <Image
        src="/logo-light-160.png"
        alt="Matchmaking Platform"
        width={size}
        height={size}
        unoptimized
        priority={priority}
        className="dark:hidden"
      />
      <Image
        src="/logo-dark-160.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        unoptimized
        priority={priority}
        className="hidden dark:block"
      />
    </>
  );
}
