import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CustomLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  text?: string;
  variant?: "logo" | "dots" | "logo-with-dots";
}

function CustomLoader({ 
  className, 
  size = "md", 
  showText = true,
  text = "Загрузка...",
  variant = "logo",
  ...props 
}: CustomLoaderProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
    xl: "w-32 h-32",
  };

  const iconSizeClasses = {
    sm: "w-3 h-3",
    md: "w-6 h-6",
    lg: "w-10 h-10",
    xl: "w-20 h-20",
  };

  const LogoLoader = () => (
    <div className={cn("relative", sizeClasses[size])}>
      <div className="relative w-full h-full">
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0, -5, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.img
            src="/logo_etu.png"
            alt="Логотип"
            className={cn(
              "rounded-full bg-white shadow-lg p-1",
              iconSizeClasses[size]
            )}
            animate={{ 
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </div>
    </div>
  );

  const DotsLoader = () => (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-2">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "rounded-full bg-gray-400", // Серый цвет для точек
              size === "sm" && "w-2 h-2",
              size === "md" && "w-3 h-3",
              size === "lg" && "w-4 h-4",
              size === "xl" && "w-6 h-6"
            )}
            animate={{
              y: [0, -10, 0],
              scale: [1, 1.2, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );

  const LogoWithDotsLoader = () => (
    <div className="flex flex-col items-center justify-center space-y-2">
      <LogoLoader />
      <div className="flex items-center justify-center gap-2 pt-2">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "rounded-full bg-primary",
              size === "sm" && "w-1.5 h-1.5",
              size === "md" && "w-2 h-2",
              size === "lg" && "w-3 h-3",
              size === "xl" && "w-4 h-4"
            )}
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );

  const LoaderComponent = () => {
    switch (variant) {
      case "dots":
        return <DotsLoader />;
      case "logo-with-dots":
        return <LogoWithDotsLoader />;
      case "logo":
      default:
        return <LogoLoader />;
    }
  };

  return (
    <div
      className={cn("flex flex-col items-center justify-center", className)}
      {...props}
    >
      <LoaderComponent />

      {showText && variant !== "dots" && (
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.p
            className="text-muted-foreground font-medium"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {text}
          </motion.p>
        </motion.div>
      )}

      {showText && variant === "dots" && (
        <motion.div
          className="mt-2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.p
            className="text-muted-foreground font-medium"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {text}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}

export { CustomLoader };