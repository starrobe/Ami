---
title: Effective C++
date: 2023-05-18
tags: [C++]
---

## 习惯C++

### 条款01：视C++为一个语言联邦

C++高效编程守则视状况而变化，取决使用的是C++的哪一部分

- C
- Object-Oriented C++
- Template C++
- STL

### 条款02 尽量以const, enum, inline替换 #define

当编译器不允许在class中为static常量赋初值，但又需要一个初值时

```cpp
class Entity
{
private:
  static const int Num = 1;
  int m_Array[Num];
};

const int Entity::Num;
```

可使用"the enum hack"补偿做法(*在模板元编程常用到*)

```cpp
class Entity
{
private:
  enum { Num = 1 };
  int m_Array[Num];
};
```

对于

```cpp
#define CALL_WITH_MAX(a, b) f((a) > (b) ? (a): (b))

int a = 5, b = 0;
CALL_WITH_MAX(++a, b);       // a累加两次
CALL_WITH_MAX(++a, b + 10);  // a累加一次
```

使用如下替代

```cpp
template<typename T>
inline void callWithMax(const T& a, const T& b)
{
  f(a > b ? a : b)
}
```

- 对于单纯常量，最好以const对象或enum替换#define
- 对于形似函数的宏，最好改用inline函数替换#define

### 条款03 尽可能使用const

在class中定义const成员函数时，如果出现const版本与非const版本内容过长并且重复时

```cpp
class TextBlock
{
public:
  const char& operator[](std::size_t position) const
  {
    ...
    return text[position]
  }
  char& operator[](std::size_t position)
  {
    ...
    return text[position]
  }
private:
 std::string text;
};
```

可使用非const版本调用const版本，避免重复

```cpp
char& operator[](std::size_t position)
{
  return const_cast<char&>(static_cast<const TextBlock>(*this)[position]);
}
```

### 条款04 确定对象被使用前已先被初始化

- 为内置型对象进行手工初始化，因为C++不保证初始化他们
- 构造函数最好使用成员初始化列表，而不要在构造函数内使用赋值操作
- 为避免"跨编译单元的初始化次序"问题，以local static对象代替non-local static对象

    > local static对象指的是函数内的static对象

## 构造/析构/赋值运算

### 条款05 了解C++合成并调用了哪些函数

### 条款06 不想使用编译器自动生成的函数，就应该明确拒接

### 条款07 为多态基类声明virtual析构

- 带多态时，基类应该声明一个虚析构。如果类有任何虚函数，它就应该有一个虚析构函数
- 如果类的设计不是作为基类使用，或不是为了多态，就不应该声明虚析构函数

    > 虚函数会生成虚表指针，增加类的大小

### 条款08 别让异常逃离析构函数

- 析构函数不要吐出异常，如果一个被析构函数调用的函数抛出异常，析构函数应该捕捉任何异常，
然后吞下它们或结束程序
- 如果需要对某个操作函数运行期间抛出的异常做出反应，那么class应该提供一个普通函数执行该操作
而不是在析构函数中执行操作

### 条款09 不在构造和析构函数过程中调用虚函数

### 条款10 令operator= 返回一个reference to *this

### 条款11 在operator= 中处理自赋值

```cpp
class Bitmap { ... };
class Widget
{
  ...
private:
  Bitmap* pb;
};
```

- 认同测试检验自赋值，但不具备异常安全性。当new Bitmap异常时，pd指向一块被删除的空间

    ```cpp
    Widget& Widget::operator=(const Widget& rhs)
    {
      if (this == &rhs) return *this;

      delete pb;
      pd = new Bitmap(*rhs.pb)
      return *this;
    }
    ```

- 在复制pb所指内容之前，不删除pb

    ```cpp
    Widget& Widget::operator=(const Widget& rhs)
    {
      Bitmap* pOrign = pb;
      pd = new Bitmap(*rhs.pb)
      delete pOrign;
      return *this;
    }
    ```
- copy and swap

    ```cpp
    void swap(Widget& lhs, Widget& rhs)
    {
      // 交换lhs与rhs的数据
    }
    Widget& Widget::operator=(const Widget& rhs)
    {
      Widget temp(rhs);
      swap(temp, *this);
      return *this;
    }

    /* 或者直接在实参传递时copy */
    Widget& Widget::operator=(Widget rhs)
    {
      swap(rhs, *this);
      return *this;
    }
    ```

### 条款12 复制对象时不要遗漏成员

- 拷贝函数应该确保复制"对象的所有成员变量"以及"所有base class部分"
- 拷贝构造与拷贝运算符不要相互调用，避免代码重复的话可共同调用第三个函数如init()

## 资源管理

### 条款13 以对象管理资源

- 为防止资源泄露，请使用RAII对象，他们在构造函数中获得资源并在析构函数中释放资源

    > RAII即Resource Acquisition Is Initalization，资源获取即初始化

### 条款14 在资源管理类中小心拷贝行为

```cpp
class Lock
{
public:
  explicit Lock(Mutex* pm) : mutexPtr(pm) { lock(mutexPtr); }
  ~Lock() { unlock(mutexPtr); }
private:
  Mutex* mutexPtr;
};
```

- 禁止复制
- 引用计数

    ```cpp
    class Lock
    {
    public:
      explicit Lock(Mutex* pm) : mutexPtr(pm, unlock) { lock(mutexPtr.get()); }

    private:
      std::shared_ptr<Mutex> mutexPtr;
    };
    ```

### 条款15 在资源管理类中提供对原始资源的访问

- 每个RAII class应该提供一个取得所管理资源的办法
    - 显示转换：定义get()
    - 隐式转换：类型转换运算符operator *type*() const;

### 条款16 成对使用new和delete时采取相同形式

### 条款17 以独立语句将newed对象置入智能指针

```cpp
int priority();
void processWidget(std::shared_ptr<Widget>, int);

processWidget(std::shared_ptr<Widget>(new Widget), priority());
```

实参的运行次序是不定的，当priority()在new Widget与`shared_ptr`构造函数之间运行时，如果导致异常new Widget返回的
指针将会遗失，造成资源泄露。因此应该使用分离语句

```cpp
std::shared_ptr<Widget> pw(new Widget);
processWidget(pw, priority());
```

## 设计与声明

### 条款18 让接口容易被正确使用，不易被误用

### 条款19 设计class犹如type

### 条款20 传const引用替换传值

- 尽量以*pass-py-reference-to-const*替换*pass-py-value*，前者通常比较高效，并可避免切割问题

    > 切割问题指在动态类型中，只有子类指针与引用具备多态，其他情况下用子类表示基类会导致子类的特殊部分
    被切割

- 以上规则并不适用于内置类型，以及STL的迭代器和函数对象。对他们而言，*pass-py-value*往往比较适当

### 条款21 必须返回对象时不要返回引用

### 条款22 将成员变量声明为private

protected并不比public更有封装性。当一个public变量被取消时，会破坏所有使用它的代码，protected同理，
会破坏所有子类中使用它的代码。

因此只有两种访问权限：private(提供封装)和其他(不提供封装)

### 条框23 以non-member、non-friend替代member函数

可增加封装性、包裹弹性以及机能扩充性

### 条框24 若所有参数都需要类型转换，请采用non-member函数

```cpp
class Rational
{
public:
  const Rational operator*(const Rational& rhs)
  {
    ...
  }
};

Rational test, result;
result = test * 2;
result = 2 * test;  // 并不能通过编译
```

需要为函数的所有参数进行类型转换时，这个函数必须为non-member

```cpp
class Rational;
const Rational operator*(const Rational& lhs, const Rational& rhs)
{
 ...
}
```

### 条款25 考虑写个不抛异常的swap函数

- 当std::swap对自定义类型效率不高时，提供一个swap成员函数，并确定这个函数不抛出异常
- 如果提供了一个member swap，也该提供一个non-member swap调用前者。对于非模板类也请特化std::swap

    ```cpp
    class Widget
    {
    public:
      void swap(Widget& other)
      {
        using std::swap;
        swap(xxx, other.xxx);
      }
    }

    namespace std
    {
      template<>
      void swap<Widget>(Widget& a, Widget& b)
      {
        a.swap(b);
      }
    }
    ```

    但当Widget为模板类时，就无法特化std::swap

    ```cpp
    template<typename T> class Widget;
    namespace std
    {
      template<typename T>
      void swap<Widget<T>>(Widget<T>& a, Widget<T>& b)
      {
        a.swap(b);
      }

      // 上面为部分特化，而函数不支持部分特化
      // 相当于将T1特化为Widget(我猜的)
      // template<typename T1, typename T>
      // void swap<T1<T>>(T1<T>&, T1<T>&)
    }
    ```

- 调用swap时应声明`using std::swap`，然后调用不带任何命名空间修饰的swap。这样编译器会先择合适的swap
- 为自定义类型进行std template全特化是好的，但不要尝试在std中加入新的东西

    模板类时，无法部分特化std::swap函数，但可以重载std::swap。不过重载属于添加新的模板，不推荐

    ```cpp
    namespace std
    {
      template<typename T>
      void swap(Widget<T>& a, Widget<T>& b)
      {
        a.swap(b);
      }
    }
    ```

    但可以重新声明个non-member swap来调用member swap

    ```cpp
    namespace WidgetStuff
    {
      template<typename T>
      class Widget { ... };
      ...
      template<typename T>
      void swap(Widget<T>& a, Widget<T>& b)
      {
        a.swap(b);
      }
    }
    ```

## 实现

### 条款26 尽可能延后变量定义的时间

### 条款27 少做类型转换

### 条款28 避免返回handles指向对象内部成分

> handles(号码牌，用来取得某个对象)指引用、指针和迭代器

### 条款29 为异常安全努力

### 条款30 透彻了解inline

### 条款31 将文件的编译依存关系降到最低

## 继承于面向对象设计

### 条款32 public继承塑造出is-a关系

`class derived : public base`即derived is a base

### 条款33 避免遮掩继承来的名称

derived class 内的名称会遮掩base class 中的名称。为避免，可在基类使用using声明

```cpp
class Base
{
public:
  void mf3();
};
class Derived
{
public:
  using Base::mf3;
  // 因为在作用域按名称查找，当前作用域中只要名称匹配就会停止，无匹配才会向外继续查找
  void mf3(int);
};
```

### 条款34 区分接口设计与实现继承

### 条款35 考虑virtual函数以外的其他选择

- non-virtual interface(NVI)手法。是*Template Method*设计模式的一种特殊形式，以public non-virtual
成员函数包裹低访问性(private, protected)的virtual函数
- 将virtual函数替换为函数指针或std::function对象，这是*Strategy*设计模式的一种形式

### 条款36 不重新定义继承而来的non-virtual函数

### 条款37 不重新定义继承而来的缺省参数值

```cpp
class Shape
{
public:
  enum ShapeColor { Red, Green, Blue };
  virtual void draw(ShapeColor color = Red) const = 0;
};
class Rectangle: public Shape
{
public:
  virtual void draw(ShapeColor color = Green) const;
};

Shape* pr = new Rectangle;
pr.draw();
```

虽然draw函数会动态绑定，即调用Rectangle的draw。但draw函数的默认实参只能静态绑定，
即使用静态类型Shape的draw的默认实参<br>
当Rectangle::draw()的默认实参定义与基类一样时，如果Shape类的默认实参改变，也就必须同时修改
Rectangle处的代码。可使用条款35中的NVI来解决，定义public函数调用virtual函数

### 条款38 复合的has-a与"根据某物实现出"

- 在应用域，复合意味着has-a。如：Person有一个Address

    ```cpp
    class Address;
    class Person
    {
    public:
      Address m_address;
    }
    ```

- 在实现域，复合意味着"根据...实现出"。如：根据list实现Set

    ```cpp
    template<typename T>
    class Set
    {
    private:
      std::list<T> rep;
    }
    ```

### 条款39 审慎地使用private继承

- private继承意味着is-implemented-in-terms-of。通常比复合的级别低(~~优先使用聚合，但不知道此处级别低有没有其他含义~~)。但当子类需要访问基类protected
成员或需要重新定义virtual函数时，可以使用private继承

- 和复合不同，private继承可以使empty base optimization(EBO，空白基类最优化)，可使对象尺寸最小化

    > 空白类不是专指这样`class A {};`，类中什么都没有。可能含有typedefs，enums，static成员变量
    > 或non-virtual函数

    ```cpp
    class A {};
    class B
    {
      int i;
      A a;
    };
    // sizeof(B) > sizeof(int)
    // 但是class B: private A { int i; }; 这样sizeof(B) == sizeof(int)成立
    ```

### 条款40 审慎使用多重继承

## 模板与泛型编程

### 条款41 了解隐式接口和编译期多态

```cpp
class Widget
{
public:
  Widget();
  virtual ~Widget();
  virtual std::size_t size() const;
  virtual void normalize();
  void swap(Widget&);
  ...
};

void doProcessing(Widget& w)
{
  if(w.size() > 10 && w != otherWidget)
  {
    Widget temp(w);
    temp.normalize();
    temp.swap(w);
  }
}
```

能在源码中找到的接口，称为显示接口，也就是它在源码中明确可见

```cpp
template<typename T>
void doProcessing(T& w)
{
  if(w.size() > 10 && w != otherWidget)
  {
    Widget temp(w);
    temp.normalize();
    temp.swap(w);
  }
}
```

w的类型T**好像**必须支持size，normalize和swap成员函数以及其他，这些便是T必须支持的隐式接口

凡是涉及w的函数调用，例如`operator>`和operator!=，可能造成template具现化。以不同的template参数具现化
function template会导致调用不同的函数，这就是编译期多态

### 条款42 typename的双重意义

- 声明template参数时，class与typename是一样的
- 请使用typename标识嵌套从属类型名称，但不得在继承时的基类列表和成员初始化列表内以它作为基类修饰符

### 条款43 处理模板化基类内的名称

```cpp
template<typename T>
class MsgSender
{
public:
  void sendClear();
};

template<typename T>
class LoggingMsgSender: public MsgSender<T>
{
public:
  void sendClearMsg()
  {
    sendClear();  // 无法通过编译，因为编译器无法知道MsgSender<T>是否有sendClear函数
    ...
  }
};
```

- 使用`this->`调用基类函数即`this->sendClear();`
- 使用using声明基类函数，`using MsgSender<T>::sendClear;`
- 明确指出函数位于基类，`MsgSender<T>::sendClear();`，但如果被调用的为虚函数，就只会调用基类虚函数了

### 条款44 将与参数无关的代码抽离template

### 条款45 运用成员函数模板接受所有兼容类型

### 条款46 需要类型转换时请为模板定义非成员模板

```cpp
template<typename T>
class Rational
{
public:
  Rational(const T& numberator = 0, const T& denominator = 1);
};
template<typename T>
const Rational<T> operator*(const Rational<T>& lhs, const Rational<T>& rhs)
{
...
}

Rational<int> one_half(1, 2);
Rational<int> result = one_half * 2; //无法通过编译
```

`operator*`为函数模板，在使用`one_half * 2`时，会根据实参推到T,具现化一个`operator*`

`one_half`为`Rational<int>`类型，很容易推出T为int，但第二个实参"2"并不能推导出`const Rational<T>&`
中的T。函数模板并不会在通过实参推到T时，将实参进行隐式转换，即不能将"2"隐式构造为`Rational<int>`

可将`operator*`声明为friend函数，在声明`one_half`时，`Rational<int>`被具现化，friend也被自动声明，friend函数
并非函数模板，因此在调用时可以隐式转换

```cpp
template<typename T>
class Rational
{
public:
  friend const Rational operator*(const Rational<T>& lhs, const Rational<T>& rhs);
};
template<typename T>
const Rational<T> operator*(const Rational<T>& lhs, const Rational<T>& rhs)
{
...
}
```

上述虽然可以通过编译，但由于类模板Rational中`operator*`是个普通函数的友元声明，而非模板函数，
无法与下面的`operator*`模板函数的定义链接

- 可直接在模板类中声明并定义友元

    ```cpp
    template <typename T>
    class Rational
    {
    public:
      friend const Rational operator*(const Rational<T>& lhs, const Rational<T>& rhs)
      {
      ...
      }
    }
    ```

    由于类中定义默认为inline，可另外定义个函数进行相乘的逻辑，而用类内的函数调用

- 类前声明函数，类内声明友元，类外定义函数

    ```cpp
    template <typename T> clas Rational;
    template <typename T>
    const Rational operator*(const Rational<T>& lhs, const Rational<T>& rhs);

    template <typename T>
    class Rational
    {
    public:
      friend const Rational operator*<T>(const Rational<T>& lhs, const Rational<T>& rhs)
    }

    template<typename T>
    const Rational<T> operator*(const Rational<T>& lhs, const Rational<T>& rhs)
    {
    ...
    }
    ```

### 条款47 使用traits classes表现类型信息

- Traits classes使得类型相关信息在编译期可用，它们以template和template特化完成实现
- 通过重载，traits classes可以在编译期对类型进行if...else

    ```cpp
    template <typename IterT, typename DistT>
    void Advance(IterT& iter, DistT d)
    {
      if(typeid(typename std::iterator_traits<IterT>::iterator_category))
            == typeid(std::random_access_iterator_tag)
      {
      ...
      }
    }
    ```

    在编译期就知道IterT的类型，但if语句在运行时才会核定，因此可通过函数重载实现在编译时的
    if判断

    ```cpp
    template <typename IterT, typename DistT>
    void doAdvance(IterT& iter, DistT d, std::random_access_iterator_tag)
    {
      iter += d;
    }
    template <typename IterT, typename DistT>
    void doAdvance(IterT& iter, DistT d, std::bidirectional_iterator_tag)
    {
      if(d >= 0) {while(d--) ++iter;}
      else {while(d++) --iter;}
    }

    template <typename IterT, typename DistT>
    void Advance(IterT& iter, DistT d)
    {
      doAdvance(iter, d, typename std::iterator_traits<IterT>::iterator_category)
    }
    ```

### 条款48 template元编程

## 定制new和delete

### 条款49 new-handler的行为

当operator new抛出异常前，会先调用客户指定的错误处理函数new-handler。为了指定该函数，必须调用`set_new_handler`

```cpp
namespace std
{
  typedef void (*new_handler)();
  new_handler set_new_handler(new_handler p) throw();
}
```

`set_new_handler`返回值指向的是被调用前正在执行(但马上要被p替换的)那个new-handler函数

```cpp
void OutOfMemeory()
{
  std::cerr << "..." << "\n";
  std::abort();
}

int main()
{
  std::set_new_handler(OutOfMemeory);
  int* pBigDataArrary = new int[100000000L];
}
```

有时候需要以不同的方式处理内存分配失败的情况，希望不同的class有不同的处理

```cpp
class A
{
public:
  static void OutOfMemeory();
};
class B
{
public:
  static void OutOfMemeory();
};

A* pa = new A; // 分配失败时调用A::OutOfMemeory()
B* pb = new B; // 分配失败时调用B::OutOfMemeory()
```

并不支持class的专属new-handler，但为每个class提供自己的`set_new_handler`和operator new即可

- `set_new_handler`指定class的专属new-handler
- operator new确保在分配class对象内存时，以class专属new-handler替换global new-handler

```cpp
class Widget
{
public:
  static std::new_handler set_new_handler(std::new_handler p) throw();
  static void* operator new(std::size_t size) throw(std::bad_alloc);
private:
  static std::new_handler current_handler;
};

std::new_handler Widget::current_handler = nullptr;
std::new_handler Widget::set_new_handler(std::new_handler p) throw()
{
  std::new_handler old_handler = current_handler;
  current_handler = p;
  return old_handler;
}
```

在operator new中，调用`std::set_new_handler`，当global operator new无法分配足够内存，抛出异常后需要
将global new-handler恢复。而成功分配内存也需要恢复global new-handler，因此创建资源管理类

```cpp
class NewHandlerHolder
{
public:
  explicit NewHandlerHolder(std::new_handler nh): handler(nh) {}
  ~NewHandlerHolder()
  {
    std::set_new_handler(handler);
  }
  NewHandlerHolder(const NewHandlerHolder&) = delete;
  NewHandlerHolder& operator=(const NewHandlerHolder&)

private:
  std::new_handler handler;
};
```

此时，operator new实现

```cpp
void* Widget::operator new(std::size_t size) throw(bad_alloc)
{
  NewHandlerHolder h(std::set_new_handler(current_handler));
  return ::operator new(size);
}
```

实现这一方案的代码并不因为class的不同而改变，类中的operator new，`set_new_handler`函数可以进行复用
而非在每个想要自定义new-handler的类中，声明这些static函数以及定义static变量

由于`current_handler`为静态变量，如果直接继承，多个子类中的`current_handler`是同一个，因此将父类定义成模板
每个子类继承的父类就不同

```cpp
template <typename T> // T并没有被使用，只是便于生成不同的父类
class NewHandlerSupport
{
public:
  static std::new_handler set_new_handler(std::new_handler p) throw();
  static void* operator new(std::size_t size) throw(std::bad_alloc);
private:
  static std::new_handler current_handler;
};

class Widget: public NewHandlerSupport<Widget>
{
...
};
```

operator new无法分配足够内存时，应该抛出`bad_alloc`异常，但同时也可指定返回0即

```cpp
Widget* p1 = new Widget;                // 失败时抛出异常
Widget* p2 = new(std::nothrow) Widget;  // 失败时返回0
```

> nothrow只是保证operator new，而new分配内存调用operator new后还会调用构造函数，因此new(std::nothrow) Widget还是会有异常

### 条款50 new和delete的合理替换时机

### 条款51 编写new和delete时需固守常规

- operator new应该含有一个无限循环，在循环中分配内存，如果无法满足内存需求，就该调用new-handler。同时
也应该有处理0字节的申请。以及class专属版本中，如果子类(Derived)继承父类(Base)的operator new，此时的大小
为sizeof(Derived)，而调用的时Base::operator new，函数可能有依照sizeof(Base)设计的其他功能

    ```cpp
    void* operator new(std::size_t size) throw(std::bad_alloc)
    {
      if(size == 0) //处理0字节申请
        size = 1;
      while(true)
      {
        分配size大小的内存
        if(分配成功)
          return 地址;

        // 获取当前new-handler，只能通过set_new_handler获得
        std::new_handler global_handler = set_new_handler(nullptr);
        set_new_handler(global_handler);

        if(global_handler)
          global_handler();
        // 只有当new-handler指针为null时，才抛出异常
        else throw std::bad_alloc();
      }
    }
    ```

    Base class专属operator new

    ```cpp
    void* Base::operator new(std::size_t size) throw(std::bad_alloc)
    {
      // size为0或子类调用时，size与sizeof(Base)不等
      if(size != sizeof(Base))
        return ::operator new(size)

      ...
    }
    ```

- operator delete在收到nullptr时，不做任何事。class专属的operator delete应该处理大小不同的问题

    ```cpp
    void Base::operator delete(void* raw_memory, std::size_t size)
    {
      if(raw_memory)
      {
        if(size != sizeof(Base))
        {
          ::operator delete(raw_memory);
          return;
        }
        return;
      }
    }
    ```

### 条款52 写了placement new也应有placement delete

- 写了placement operator new也应该写出对于的placement operator delete

    placement new指接受额外参数的operator new，placement delete指接受额外参数的operator delete

    > 特别的一个placement new是，接受一个指针，指向对象该被构造的地址

    operator new成功分配内存，但对象构造时出现异常后，会调用operator delete恢复原先的内存，
    而使用placement new后，如果没有对应的placement delete，就不会有任何的operator delete被调用

    如果没有发生异常，在最终释放分配空间时

    ```cpp
    void* Widget::operator new(std::size_t size, std::ostream& log_stream) throw(std::bad_alloc);
    void Widget::operator delete(void* pmemory) throw();
    void Widget::operator delete(void* pmemory, std::ostream& log_stream) throw();

    Widget* pw = new(std::cerr) Widget;
    delete pw;
    ```

    delete pw调用的是正常的operator new而非placement delete。placement delete只有在"伴随placement new调用而触发
    的构造函数"出现异常时才会被调用。因此，除了placement delete外，还需提供一个正常的operator delete

- 当你声明placement new和placement delete，请不要遮掩正常版本

    成员函数的名称会遮掩外围作用域中相同的名称

    ```cpp
    class Base
    {
    public:
      static void* operator new(std::size_t size, std::ostream& log_stream) throw(std::bad_alloc);
    };
    Base* pb = new Base;            // 错误，正常形式的operator new被遮掩
    Base* pb = new(std::cerr) Base;
    ```

